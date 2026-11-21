'use strict';

require('./helpers/guard-store');
const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const tax = require('../lib/tax');
const coupons = require('../lib/coupons');

test('checkout contract: SAVE10 is capped at INR 150 before 5% GST', () => {
  const result = pricing.computeTotals([{ price: 1120, qty: 2, hsn: '1508' }], 'SAVE10');
  assert.deepEqual([result.subtotal, result.discount, result.tax, result.total], [2240, 150, 104.5, 2194.5]);
});

test('checkout contract: flat discount is proportionally apportioned before mixed-slab GST', () => {
  const result = pricing.computeTotals([
    { price: 260, qty: 1, hsn: '0405' },
    { price: 140, qty: 1, hsn: '0902' }
  ], 'FLAT50');
  assert.deepEqual(result.lines.map(line => [line.discount, line.taxable, line.tax]), [
    [32.5, 227.5, 27.3], [17.5, 122.5, 22.05]
  ]);
  assert.deepEqual([result.discount, result.tax, result.total], [50, 49.35, 399.35]);
  assert.equal(pricing.round2(result.cgst + result.sgst), result.tax);
});

for (const [code, subtotal, expected] of [
  ['save10', 1020, 102], [' SAVE10 ', 2240, 150],
  ['SAVE10', 499.99, 0], ['FLAT50', 299.99, 0],
  ['DIWALI20', 2000, 0], ['UNKNOWN', 2000, 0],
  ['WELCOME', 4000, 100], ['WHOLESALE15', 4000, 400]
]) {
  test(`checkout coupon contract: ${JSON.stringify(code)} at ${subtotal}`, () => {
    assert.equal(coupons.calculateDiscount(subtotal, code), expected);
  });
}

test('GST contract: HSN slabs, explicit percentage/decimal/zero and fallback', () => {
  assert.deepEqual([
    tax.getRateForItem({ hsn: '1006' }), tax.getRateForItem({ hsn: '0405' }),
    tax.getRateForItem({ hsn: '0902' }), tax.getRateForItem({ gstRate: 12 }),
    tax.getRateForItem({ gstRate: 0.12 }), tax.getRateForItem({ gstRate: 0 }),
    tax.getRateForItem({ hsn: 'unknown' })
  ], [0.05, 0.12, 0.18, 0.12, 0.12, 0, 0.18]);
});

test('checkout contract: tax is rounded per line, CGST gets the odd paise', () => {
  const result = pricing.computeTotals([{ price: 0.1, qty: 1, hsn: '1006' }], '');
  assert.equal(result.tax, 0.01);
  assert.equal(result.cgst, 0.01);
  assert.equal(result.sgst, 0);
  assert.equal(result.total, 0.11);
});
