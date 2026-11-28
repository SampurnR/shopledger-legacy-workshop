var dates = require('./dates');
var inventory = require('./inventory');
var ledger = require('./ledger');

exports.add = function (db, orderData) {
  var order = {
    id: db.nextOrderId++,
    date: orderData.date || dates.today(),
    customer: orderData.customer || 'Walk-in',
    customerId: orderData.customerId || null,
    paymentMode: orderData.paymentMode || 'cash',
    status: orderData.status || 'completed',
    items: orderData.items || [],
    coupon: orderData.coupon || '',
    subtotal: orderData.subtotal,
    discount: orderData.discount,
    tax: orderData.tax,
    total: orderData.total,
    requestId: orderData.requestId || null,
    requestFingerprint: orderData.requestFingerprint || null
  };

  db.orders.push(order);
  return order;
};

exports.findByRequestId = function (db, requestId) {
  if (!requestId) return null;
  for (var i = 0; i < (db.orders || []).length; i++) {
    if (db.orders[i].requestId === requestId) return db.orders[i];
  }
  return null;
};

exports.isValidStatus = function (status) {
  return !status || status === 'completed' || status === 'pending';
};

exports.resolveItems = function (products, rawItems) {
  if (!Array.isArray(rawItems)) return { ok: false, error: 'Order items must be a list' };
  var items = [];
  for (var i = 0; i < rawItems.length; i++) {
    var p = inventory.find(products, rawItems[i] && rawItems[i].id);
    if (!p) return { ok: false, error: 'Unknown product ID ' + (rawItems[i] && rawItems[i].id) };
    var qty = Number(rawItems[i].qty);
    if (!isFinite(qty) || qty < 1 || Math.floor(qty) !== qty) {
      return { ok: false, error: 'Quantity for ' + p.name + ' must be a positive whole number' };
    }
    var existing = null;
    for (var j = 0; j < items.length; j++) {
      if (items[j].id === p.id) { existing = items[j]; break; }
    }
    if (existing) {
      existing.qty += qty;
    } else {
      items.push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        hsn: p.hsn,
        gstRate: p.gstRate,
        price: p.price,
        qty: qty
      });
    }
  }
  return { ok: true, items: items };
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
  inventory.release(db.products, order.items);

  // If billed to customer khata, reverse the debit on their credit account
  if (order.paymentMode === 'khata' && order.customerId) {
    ledger.reverseOrderDebit(db, order.customerId, order.total);
  }

  return { ok: true, order: order };
};

exports.complete = function (db, id) {
  var order = exports.get(db, id);
  if (!order) return { ok: false, error: 'Order not found' };
  if (order.status !== 'pending') {
    return { ok: false, error: 'Only pending orders can be marked as dispatched' };
  }
  order.status = 'completed';
  order.completedAt = dates.today();
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

  if (opts.from) {
    var fromKey = dates.normalizeDateKey(opts.from);
    list = list.filter(function (o) {
      return dates.normalizeDateKey(o.date) >= fromKey;
    });
  }

  if (opts.to) {
    var toKey = dates.normalizeDateKey(opts.to);
    list = list.filter(function (o) {
      return dates.normalizeDateKey(o.date) <= toKey;
    });
  }

  // newest first
  return list.sort(function (a, b) {
    var aKey = dates.normalizeDateKey(a.date);
    var bKey = dates.normalizeDateKey(b.date);
    return aKey < bKey ? 1 : (aKey > bKey ? -1 : 0);
  });
};
