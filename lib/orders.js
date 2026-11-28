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

  // Stage reservation changes so release cannot leave a partially cancelled order.
  var products;
  try {
    products = db.products.map(function (product) {
      return product && Object.assign({}, product);
    });
    inventory.release(products, order.items);
  } catch {
    return { ok: false, error: 'Unable to release inventory for order #' + order.id };
  }
  var invalidRelease = products.some(function (product, index) {
    return product && product.reserved !== db.products[index].reserved && !Number.isFinite(product.reserved);
  });
  if (invalidRelease) {
    return { ok: false, error: 'Invalid inventory reservation for order #' + order.id };
  }

  var cancelledAt = dates.today();
  if (order.paymentMode === 'khata' && order.customerId) {
    var reversal = ledger.reverseOrderDebit(db, order.customerId, order.total);
    if (!reversal.ok) return reversal;
  }

  products.forEach(function (product, index) {
    if (product && product.reserved !== db.products[index].reserved) {
      db.products[index].reserved = product.reserved;
    }
  });
  order.status = 'cancelled';
  order.cancelledAt = cancelledAt;
  order.cancelReason = reason || 'Cancelled by operator';

  return { ok: true, order: order };
};

function chronologicalDateKey(date) {
  if (typeof date !== 'string') return '';
  var parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dates.normalizeDateKey(date));
  if (!parts) return '';

  var day = Number(parts[1]);
  var month = Number(parts[2]);
  var year = Number(parts[3]);
  var leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  var monthDays = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year === 0 || month < 1 || month > 12 || day < 1 || day > monthDays[month - 1]) return '';

  return parts[3] + '-' + parts[2].padStart(2, '0') + '-' + parts[1].padStart(2, '0');
}

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

  var hasFrom = opts.from != null && opts.from !== '';
  var hasTo = opts.to != null && opts.to !== '';
  if (hasFrom || hasTo) {
    var fromKey = chronologicalDateKey(opts.from);
    var toKey = chronologicalDateKey(opts.to);
    if ((hasFrom && !fromKey) || (hasTo && !toKey)) return [];

    list = list.filter(function (o) {
      var key = chronologicalDateKey(o.date);
      return key && (!hasFrom || key >= fromKey) && (!hasTo || key <= toKey);
    });
  }

  // newest first
  return list.sort(function (a, b) {
    var aKey = chronologicalDateKey(a.date);
    var bKey = chronologicalDateKey(b.date);
    if (aKey === bKey) return 0;
    return aKey < bKey ? 1 : -1;
  });
};
