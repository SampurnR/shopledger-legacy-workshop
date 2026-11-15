var test = require('node:test');
var assert = require('node:assert/strict');

var coupons = require('../lib/coupons');
var dates = require('../lib/dates');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');

test('pricing applies coupon discount before product GST and splits GST', function () {
  var totals = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 500, qty: 2 }
  ], 'SAVE10');

  assert.equal(totals.subtotal, 1000);
  assert.equal(totals.discount, 100);
  assert.equal(totals.taxable, 900);
  assert.equal(totals.tax, 45);
  assert.equal(totals.cgst + totals.sgst, 45);
  assert.equal(totals.total, 945);
});

test('coupon codes are trimmed and case-insensitive; expired coupons are rejected', function () {
  assert.equal(coupons.normalizeCode(' save10 '), 'SAVE10');
  assert.equal(coupons.validate('SAVE10', 500).valid, true);
  assert.match(coupons.validate('SAVE10', 499).error, /minimum order/i);
  assert.match(coupons.validate('DIWALI20', 2000).error, /expired/i);
});

test('inventory check keeps one unit below sellable stock as a buffer', function () {
  var products = [{ id: 1, name: 'Tea', stock: 5, reserved: 1 }];

  assert.equal(inventory.getSellableStock(products[0]), 4);
  assert.equal(inventory.check(products, [{ id: 1, qty: 3 }]).ok, true);
  assert.equal(inventory.check(products, [{ id: 1, qty: 4 }]).ok, false);
});

test('order cancellation marks an order but does not restore stock deducted at placement', function () {
  var db = {
    nextOrderId: 8,
    orders: [{ id: 7, status: 'completed', items: [{ id: 2, qty: 2 }], paymentMode: 'cash' }],
    products: [{ id: 2, stock: 3, reserved: 0 }],
    customers: []
  };

  var result = orders.cancel(db, 7, 'Customer changed mind');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(result.order.cancelReason, 'Customer changed mind');
  assert.equal(db.products[0].reserved, 0);
  // Characterizes current behavior: cancel looks for productId and only adjusts reserved.
  assert.equal(db.products[0].stock, 3);
});

test('dates normalize HTML date-picker values and calculate Indian fiscal years', function () {
  assert.equal(dates.normalizeDateKey('2026-04-01'), '01/04/2026');
  assert.equal(dates.getFiscalYear('01/04/2026'), 'FY26-27');
  assert.equal(dates.getFiscalYear('31/03/2026'), 'FY25-26');
});
