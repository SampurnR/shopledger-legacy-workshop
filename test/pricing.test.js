'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const tax = require('../lib/tax');
const coupons = require('../lib/coupons');

const mixedItems = () => [
  { id: 1, name: 'Fixture rice', hsn: '1006', price: 100, qty: 1 },
  { id: 2, name: 'Fixture ghee', hsn: '0405', price: 100, qty: 1 },
  { id: 3, name: 'Fixture tea', hsn: '0902', price: 100, qty: 1 }
];

test('checkout resolves mixed HSN slabs of 5%, 12%, and 18%', () => {
  const result = pricing.computeTotals(mixedItems(), '');
  assert.equal(result.subtotal, 300);
  assert.equal(result.discount, 0);
  assert.equal(result.taxable, 300);
  assert.equal(result.tax, 35);
  assert.equal(result.cgst, 17.5);
  assert.equal(result.sgst, 17.5);
  assert.equal(result.total, 335);
  assert.deepEqual(result.lines.map(line => [line.gstPercent, line.tax, line.net]), [[5, 5, 105], [12, 12, 112], [18, 18, 118]]);
});

test('checkout distributes WELCOME proportionally before taxing each line', () => {
  const result = pricing.computeTotals(mixedItems(), 'WELCOME');
  assert.equal(result.discount, 15);
  assert.equal(result.taxable, 285);
  assert.deepEqual(result.lines.map(line => [line.discount, line.taxable, line.tax]), [[5, 95, 4.75], [5, 95, 11.4], [5, 95, 17.1]]);
  assert.equal(result.tax, 33.25);
  assert.equal(result.cgst, 16.63);
  assert.equal(result.sgst, 16.62);
  assert.equal(result.total, 318.25);
});

test('checkout SAVE10 on 1020 bills 963.90 with 45.90 GST', () => {
  const result = pricing.computeTotals([{ id: 1, hsn: '1006', price: 510, qty: 2 }], 'SAVE10');
  assert.equal(result.subtotal, 1020);
  assert.equal(result.discount, 102);
  assert.equal(result.tax, 45.9);
  assert.equal(result.total, 963.9);
});

test('checkout caps SAVE10 at 150 on a 2240 subtotal', () => {
  const result = pricing.computeTotals([{ id: 1, hsn: '1508', price: 1120, qty: 2 }], 'SAVE10');
  assert.equal(result.discount, 150);
  assert.equal(result.taxable, 2090);
  assert.equal(result.tax, 104.5);
  assert.equal(result.total, 2194.5);
});

test('checkout FLAT50 reduces the taxable subtotal before GST', () => {
  const result = pricing.computeTotals([{ id: 1, hsn: '0405', price: 400, qty: 1 }], 'FLAT50');
  assert.equal(result.discount, 50);
  assert.equal(result.taxable, 350);
  assert.equal(result.tax, 42);
  assert.equal(result.total, 392);
});

test('coupon validation normalizes codes and enforces minimums and active status', () => {
  assert.equal(coupons.normalizeCode(' save10 '), 'SAVE10');
  assert.equal(coupons.validate(' save10 ', 500).discount, 50);
  assert.equal(coupons.validate('SAVE10', 499).valid, false);
  assert.equal(coupons.validate('FLAT50', 299).valid, false);
  assert.equal(coupons.validate('FLAT50', 300).discount, 50);
  assert.equal(coupons.validate('DIWALI20', 1000).valid, false);
  assert.equal(coupons.validate('MISSING', 1000).valid, false);
  assert.deepEqual(coupons.validate('', 100), { valid: true, code: '', discount: 0 });
  assert.equal(coupons.calculateDiscount(100, 'SAVE10'), 0);
  assert.equal(coupons.calculateDiscount(1000, 'DIWALI20'), 0);
});

test('tax module handles explicit percentage, decimal and zero rates before HSN fallback', () => {
  assert.equal(tax.getRateForItem({ hsn: '1006', gstRate: 12 }), 0.12);
  assert.equal(tax.getRateForItem({ hsn: '0405', gstRate: 0.05 }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: '1006', gstRate: 0 }), 0);
  assert.equal(tax.getRateForItem({ hsn: 'UNKNOWN' }), 0.18);
  assert.equal(tax.getRateForItem(null), 0.18);
  assert.deepEqual(tax.splitCgstSgst(0.01), { cgst: 0.01, sgst: 0 });
});

test('checkout sums rounded row taxes for small amounts', () => {
  const result = pricing.computeTotals([{ id: 1, price: 0.03, qty: 1 }, { id: 2, price: 0.03, qty: 1 }], '');
  assert.deepEqual(result.lines.map(line => line.tax), [0.01, 0.01]);
  assert.equal(result.tax, 0.02);
  assert.equal(result.total, 0.08);
});

test('checkout empty cart gives zero totals and does not mutate item fixtures', () => {
  const empty = pricing.computeTotals([], '');
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.lines, []);
  const items = mixedItems();
  const before = structuredClone(items);
  pricing.computeTotals(items, 'WELCOME');
  assert.deepEqual(items, before);
});
