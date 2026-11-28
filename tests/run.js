var assert = require('assert');
var db = require('../data/db.json');
var invoice = require('../lib/invoice');

function moneyEqual(actual, expected, message) {
  assert.strictEqual(Number(actual).toFixed(2), Number(expected).toFixed(2), message);
}

var activeOrders = db.orders.filter(function (order) {
  return order.status !== 'cancelled';
});

activeOrders.forEach(function (order) {
  var figures = invoice.computeInvoiceFigures(order);
  moneyEqual(figures.subtotal, order.subtotal, 'subtotal mismatch for order #' + order.id);
  moneyEqual(figures.discount, order.discount, 'discount mismatch for order #' + order.id);
  moneyEqual(figures.tax, order.tax, 'tax mismatch for order #' + order.id);
  moneyEqual(figures.total, order.total, 'total mismatch for order #' + order.id);
});

var order1002 = db.orders.filter(function (order) { return order.id === 1002; })[0];
var invoice1002 = invoice.computeInvoiceFigures(order1002);
moneyEqual(invoice1002.discount, 102, 'SAVE10 should discount the pre-tax subtotal');
moneyEqual(invoice1002.tax, 45.90, '5% HSN GST should apply after the coupon discount');
moneyEqual(invoice1002.total, 963.90, 'invoice #1002 should match the billed total');

var order1004 = db.orders.filter(function (order) { return order.id === 1004; })[0];
var invoice1004 = invoice.computeInvoiceFigures(order1004);
moneyEqual(invoice1004.discount, 150, 'SAVE10 should respect its maxDiscount cap');
moneyEqual(invoice1004.tax, 104.50, 'groundnut oil should use its 5% HSN GST slab');
moneyEqual(invoice1004.total, 2194.50, 'invoice #1004 should match the billed total');

assert.ok(invoice.render(order1004).indexOf('Accountant Reconciliation Notice') === -1,
  'a matching invoice must not show a reconciliation warning');

console.log('Passed invoice regression tests for ' + activeOrders.length + ' active orders.');
