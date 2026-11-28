'use strict';

// Original CP3 baseline: docs/cp3-invoice-characterization.js.txt.

const assert = require('node:assert/strict');
const test = require('node:test');
const coupons = require('../lib/coupons');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');
const tax = require('../lib/tax');

function line(price, fields = {}) {
  return { name: 'Fixture item', price, qty: 1, ...fields };
}

function billedOrder(items, coupon = '') {
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  return { id: 1, items, coupon, subtotal, discount, tax, total };
}

test('billing GST resolves HSN slabs, explicit rates, and the fallback', () => {
  assert.deepEqual([
    tax.getRateForItem({ hsn: '1006' }),
    tax.getRateForItem({ hsn: '0405' }),
    tax.getRateForItem({ hsn: '0902' }),
    tax.getRateForItem({ hsn: '9999' }),
    tax.getRateForItem({}),
    tax.getRateForItem({ hsn: '1006', gstRate: 12 }),
    tax.getRateForItem({ gstRate: 0.12 }),
    tax.getRateForItem({ hsn: '1006', gstRate: 0 })
  ], [0.05, 0.12, 0.18, 0.18, 0.18, 0.12, 0.12, 0]);
});

test('coupon validation normalizes codes and enforces minimums and percentage caps', () => {
  assert.equal(coupons.validate('SAVE10', 499.99).valid, false);
  const minimum = coupons.validate(' save10 ', 500);
  assert.equal(minimum.valid, true);
  assert.equal(minimum.code, 'SAVE10');
  assert.equal(minimum.discount, 50);
  assert.equal(coupons.validate('SAVE10', 2000).discount, 150);
  assert.equal(coupons.calculateDiscount(4000, 'WHOLESALE15'), 400);
  assert.equal(coupons.validate('DIWALI20', 2000).valid, false);
  assert.equal(coupons.validate('FLAT50', 300).discount, 50);
});

test('billing apportions a capped coupon before taxing mixed GST slabs and splits odd paise', () => {
  const { lines, ...totals } = pricing.computeTotals([
    line(400, { qty: 2, hsn: '1006' }),
    line(700, { hsn: '0405' }),
    line(500, { hsn: '0902' })
  ], 'SAVE10');

  assert.deepEqual(totals, {
    subtotal: 2000, discount: 150, taxable: 1850,
    tax: 197.95, cgst: 98.98, sgst: 98.97, total: 2047.95
  });
  assert.deepEqual(lines.map(({ gstPercent, discount, taxable, tax }) =>
    [gstPercent, discount, taxable, tax]), [
    [5, 60, 740, 37],
    [12, 52.5, 647.5, 77.7],
    [18, 37.5, 462.5, 83.25]
  ]);
});

test('invoice matches an undiscounted order with explicit whole-percentage GST rates', () => {
  const order = billedOrder([
    line(50, { name: 'Rice & grain', qty: 2, sku: 'R1', hsn: '1006', gstRate: 5 }),
    line(100, { gstRate: 12 }),
    line(100, { gstRate: 18 })
  ]);
  const { rows, ...figures } = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures, {
    subtotal: 300, discount: 0, tax: 35, cgst: 17.5, sgst: 17.5, total: 335
  });
  assert.equal(figures.total, order.total);
  assert.equal(figures.tax, order.tax);
  assert.deepEqual(rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]),
    [[5, 5], [12, 12], [18, 18]]);
  const html = invoice.render(order);
  assert.match(html, /Rice &amp; grain/);
  assert.match(html, /SKU: R1/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹335\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice and billing agree on the fallback rate for an undiscounted item without HSN', () => {
  const order = billedOrder([line(100)]);
  const result = invoice.computeInvoiceFigures(order);
  assert.equal(result.rows[0].gstPercent, 18);
  assert.equal(result.tax, 18);
  assert.equal(result.total, 118);
  assert.equal(result.tax, order.tax);
  assert.equal(result.total, order.total);
});

test('CURRENT BEHAVIOUR: rounded line discounts can exceed the cart-level discount', () => {
  const result = pricing.computeTotals(Array.from({ length: 3 }, () => line(0.1)), 'WELCOME');
  assert.deepEqual(result.lines.map(row => row.discount), [0.01, 0.01, 0.01]);
  assert.deepEqual(result.lines.map(row => row.net), [0.11, 0.11, 0.11]);
  assert.deepEqual([result.discount, result.taxable, result.tax, result.total], [0.02, 0.28, 0.06, 0.34]);
});
