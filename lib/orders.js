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
  inventory.release(db.products, order.items);

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
    return a.date < b.date ? 1 : -1;
  });
};
