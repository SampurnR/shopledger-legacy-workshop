var dates = require('./dates');

exports.add = function (db, orderData) {
  var order = {
    id: db.nextOrderId++,
    date: orderData.date || dates.today(),
    customer: orderData.customer || 'Walk-in',
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

// newest first
exports.list = function (db) {
  return db.orders.slice().sort(function (a, b) {
    return a.date < b.date ? 1 : -1;
  });
};
