var test = require('node:test');
var assert = require('node:assert/strict');

var coupons = require('../lib/coupons');
var dates = require('../lib/dates');
var inventory = require('../lib/inventory');
var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');

test('tax resolves known HSN slabs and falls back to configured default', function () {
  assert.equal(tax.getSlabPercent({ hsn: '1006' }), 5);
  assert.equal(tax.getSlabPercent({ hsn: '0405' }), 12);
  assert.equal(tax.getSlabPercent({ hsn: 'unknown' }), 18);
});

test('coupon codes are normalized and SAVE10 is capped at its maximum', function () {
  assert.equal(coupons.normalizeCode(' save10 '), 'SAVE10');
  assert.equal(coupons.calculateDiscount(2000, 'SAVE10'), 150);
  assert.equal(coupons.validate('DIWALI20', 2000).valid, false);
});

test('order pricing applies coupon discount before HSN GST', function () {
  var result = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 140, qty: 1 }
  ], 'SAVE10');

  assert.deepEqual({
    subtotal: result.subtotal,
    discount: result.discount,
    taxable: result.taxable,
    tax: result.tax,
    total: result.total
  }, { subtotal: 780, discount: 78, taxable: 702, tax: 51.48, total: 753.48 });
});

test('stock check allows an order for the last sellable unit', function () {
  var result = inventory.check([{ id: 1, name: 'Rice', stock: 1, reserved: 0 }], [{ id: 1, qty: 1 }]);
  assert.deepEqual(result, { ok: true });
});

test('cancelling an order restores sold stock without changing wholesale reservations', function () {
  var db = {
    orders: [{ id: 1001, status: 'completed', items: [{ id: 1, qty: 1 }], paymentMode: 'cash', total: 10 }],
    products: [{ id: 1, stock: 0, reserved: 0 }]
  };

  assert.equal(orders.cancel(db, 1001, 'test').ok, true);
  assert.equal(db.orders[0].status, 'cancelled');
  assert.equal(db.products[0].stock, 1);
  assert.equal(db.products[0].reserved, 0);
});

test('invoice calculator currently differs from order pricing for HSN items with coupons', function () {
  var order = {
    items: [
      { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { id: 2, name: 'Tea', hsn: '0902', price: 140, qty: 1 }
    ],
    coupon: 'SAVE10'
  };

  var orderTotal = pricing.computeTotals(order.items, order.coupon).total;
  var invoiceTotal = invoice.computeInvoiceFigures(order).total;
  assert.notEqual(invoiceTotal, orderTotal);
});

test('date normalization converts HTML date input to the stored day/month/year format', function () {
  assert.equal(dates.normalizeDateKey('2022-01-05'), '05/01/2022');
});
