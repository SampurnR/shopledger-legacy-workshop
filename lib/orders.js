var dates = require('./dates');
var inventory = require('./inventory');
var ledger = require('./ledger');
var tax = require('./tax');

exports.resolveItems = function (products, rawItems) {
  if (!Array.isArray(rawItems)) return { ok: false, error: 'Items must be an array' };

  var items = [];
  for (var i = 0; i < rawItems.length; i++) {
    var line = rawItems[i];
    if (!line || (typeof line.id !== 'number' && typeof line.id !== 'string')) {
      return { ok: false, error: 'Each item must have a product ID' };
    }
    var p = inventory.find(products, line.id);
    if (!p) return { ok: false, error: 'Unknown product ID ' + line.id };

    var qty = line.qty;
    if (typeof qty === 'string' && /^\d+$/.test(qty.trim())) qty = Number(qty);
    if (!Number.isSafeInteger(qty) || qty < 1) {
      return { ok: false, error: 'Item quantities must be positive whole numbers' };
    }

    items.push({
      id: p.id,
      sku: p.sku,
      name: p.name,
      hsn: p.hsn,
      gstRate: tax.getRateForItem(p),
      price: p.price,
      qty: qty
    });
  }
  return { ok: true, items: items };
};

exports.add = function (db, orderData) {
  var order = {
    id: db.nextOrderId++,
    date: orderData.date || dates.today(),
    customer: orderData.customer || 'Walk-in',
    customerId: orderData.customerId || null,
    paymentMode: orderData.paymentMode || 'cash',
    status: orderData.status || 'completed',
    pricingVersion: 2,
    items: orderData.items || [],
    coupon: orderData.coupon || '',
    subtotal: orderData.subtotal,
    discount: orderData.discount,
    tax: orderData.tax,
    total: orderData.total
  };

  db.orders.push(order);
  return order;
};

exports.get = function (db, id) {
  for (var i = 0; i < db.orders.length; i++) {
    if (db.orders[i].id == id) return db.orders[i];
  }
  return null;
};

// Added Aug 2021 (Rohit): cancel an order and release its inventory
exports.cancel = function (db, id, reason) {
  var order = exports.get(db, id);
  if (!order) return { ok: false, error: 'Order not found' };
  if (order.status === 'cancelled') {
    return { ok: false, error: 'Order #' + order.id + ' is already cancelled' };
  }

  order.status = 'cancelled';
  order.cancelledAt = dates.today();
  order.cancelReason = reason || 'Cancelled by operator';

  // Return items to stock
  inventory.release(db.products, order.items || []);

  // If billed to customer khata, reverse the debit on their credit account
  if (order.paymentMode === 'khata' && order.customerId) {
    ledger.reverseOrderDebit(db, order.customerId, order.total);
  }

  return { ok: true, order: order };
};

// Lists orders with optional search, status, and date range filters (newest first)
exports.list = function (db, filters) {
  var opts = filters || {};
  var list = db.orders.slice();

  if (opts.status && opts.status !== 'all') {
    list = list.filter(function (o) {
      return (o.status || 'completed') === opts.status;
    });
  }

  if (opts.search) {
    var q = String(opts.search).toLowerCase().trim();
    list = list.filter(function (o) {
      var idMatch = String(o.id).indexOf(q) !== -1;
      var custMatch = String(o.customer || 'Walk-in').toLowerCase().indexOf(q) !== -1;
      var couponMatch = String(o.coupon || '').toLowerCase().indexOf(q) !== -1;
      return idMatch || custMatch || couponMatch;
    });
  }

  var fromKey = dates.normalizeDateKey(opts.from);
  var toKey = dates.normalizeDateKey(opts.to);
  if ((opts.from && !fromKey) || (opts.to && !toKey)) return [];

  var dated = list.map(function (order) {
    return { order: order, key: dates.normalizeDateKey(order.date) };
  });
  if (fromKey || toKey) {
    dated = dated.filter(function (entry) {
      return entry.key && (!fromKey || entry.key >= fromKey) && (!toKey || entry.key <= toKey);
    });
  }
  return dated.sort(function (a, b) {
    return b.key.localeCompare(a.key) || Number(b.order.id) - Number(a.order.id);
  }).map(function (entry) {
    return entry.order;
  });
};
