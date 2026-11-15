'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');

test('pricing applies a cart coupon before the product HSN tax slab', function () {
  var totals = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }
  ], 'SAVE10');

  assert.equal(totals.subtotal, 1000);
  assert.equal(totals.discount, 100);
  assert.equal(totals.tax, 45);
  assert.equal(totals.cgst, 22.5);
  assert.equal(totals.sgst, 22.5);
  assert.equal(totals.total, 945);
  assert.equal(totals.lines[0].gstPercent, 5);
});

test('coupon codes normalize to uppercase and percent discounts respect their cap', function () {
  assert.equal(coupons.normalizeCode(' save10 '), 'SAVE10');
  assert.deepEqual(coupons.validate('save10', 3000).valid, true);
  assert.equal(coupons.calculateDiscount(3000, 'SAVE10'), 150);
});

test('inactive coupons are rejected', function () {
  assert.deepEqual(coupons.validate('DIWALI20', 2000), {
    valid: false,
    error: 'Coupon DIWALI20 has expired'
  });
});
