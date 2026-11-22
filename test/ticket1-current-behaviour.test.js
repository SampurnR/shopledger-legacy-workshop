'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const tax = require('../lib/tax');
const pricing = require('../lib/pricing');
const coupons = require('../lib/coupons');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function orderFrom(items, coupon, ledgerTotals) {
  return Object.assign({
    id: 77,
    date: '2026-11-23',
    customer: 'Test Customer',
    status: 'completed',
    coupon: coupon || '',
    items: items
  }, ledgerTotals || {});
}

const mixedRateItems = [
  { id: 8, name: 'Packaged tea', sku: 'TEA-1', hsn: '0902', price: 140, qty: 2 },
  { id: 2, name: 'Pulses', sku: 'DAL-1', hsn: '0713', price: 165, qty: 2 }
];

test('CURRENT BEHAVIOUR: tax resolves item GST rate before HSN and then default', function () {
  assert.equal(tax.getRateForItem({ gstRate: 0.12, hsn: '1006' }), 0.12);
  assert.equal(tax.getRateForItem({ gstRate: 5, hsn: '0902' }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: '1006' }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: 'unknown' }), 0.18);
  assert.equal(tax.getRateForItem(null), 0.18);
});

test('CURRENT BEHAVIOUR: coupon lookup normalizes codes, enforces eligibility, and caps discounts', function () {
  assert.equal(coupons.normalizeCode(' save10 '), 'SAVE10');
  assert.equal(coupons.validate('save10', 500).discount, 50);
  assert.equal(coupons.calculateDiscount(2240, 'SAVE10'), 150);
  assert.deepEqual(coupons.validate('DIWALI20', 2000), { valid: false, error: 'Coupon DIWALI20 has expired' });
  assert.equal(coupons.calculateDiscount(400, 'SAVE10'), 0);
  assert.equal(coupons.calculateDiscount(25, 'FLAT50'), 0);
});

test('CURRENT BEHAVIOUR: checkout prices HSN lines after allocating coupon discount', function () {
  const actual = pricing.computeTotals(mixedRateItems, '');
  assert.deepEqual({ subtotal: actual.subtotal, discount: actual.discount, taxable: actual.taxable, tax: actual.tax, cgst: actual.cgst, sgst: actual.sgst, total: actual.total }, {
    subtotal: 610, discount: 0, taxable: 610, tax: 66.9, cgst: 33.45, sgst: 33.45, total: 676.9
  });
  assert.deepEqual(actual.lines.map(function (line) { return [line.hsn, line.gstPercent, line.taxable, line.tax]; }), [
    ['0902', 18, 280, 50.4], ['0713', 5, 330, 16.5]
  ]);
});

test('invoice uses checkout HSN rates and matches its GST and total', function () {
  const checkout = pricing.computeTotals(mixedRateItems, '');
  const invoiceFigures = invoice.computeInvoiceFigures(orderFrom(mixedRateItems, ''));
  assert.deepEqual([invoiceFigures.tax, invoiceFigures.total], [checkout.tax, checkout.total]);
  assert.deepEqual(invoiceFigures.rows.map(function (line) { return line.gstPercent; }), [18, 5]);
});

test('invoice applies checkout coupon cap and discount-before-tax totals', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 2240, qty: 1 }];
  const checkout = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures(orderFrom(items, 'SAVE10'));
  assert.deepEqual([checkout.discount, checkout.tax, checkout.total], [150, 104.5, 2194.5]);
  assert.deepEqual([invoiceFigures.discount, invoiceFigures.tax, invoiceFigures.total], [checkout.discount, checkout.tax, checkout.total]);
  assert.deepEqual([invoiceFigures.discount, invoiceFigures.tax, invoiceFigures.total], [150, 104.5, 2194.5]);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
});

test('invoice flat coupon GST and total match checkout', function () {
  const items = [{ id: 7, name: 'Butter', hsn: '0405', price: 260, qty: 2 }];
  const checkout = pricing.computeTotals(items, 'FLAT50');
  const invoiceFigures = invoice.computeInvoiceFigures(orderFrom(items, 'FLAT50'));
  assert.deepEqual([checkout.discount, checkout.tax, checkout.total], [50, 56.4, 526.4]);
  assert.deepEqual([invoiceFigures.discount, invoiceFigures.tax, invoiceFigures.total], [checkout.discount, checkout.tax, checkout.total]);
  assert.deepEqual([invoiceFigures.discount, invoiceFigures.tax, invoiceFigures.total], [50, 56.4, 526.4]);
});

test('reconciliation matches checkout figures and omits cancelled orders', function () {
  const checkout = pricing.computeTotals(mixedRateItems, '');
  const active = orderFrom(mixedRateItems, '', { subtotal: checkout.subtotal, discount: checkout.discount, tax: checkout.tax, total: checkout.total });
  const cancelled = orderFrom(mixedRateItems, '', { id: 78, status: 'cancelled', subtotal: 610, discount: 0, tax: 66.9, total: 676.9 });
  const result = reports.getGstReconciliation({ orders: [active, cancelled] });
  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual([result.rows[0].ledgerTax, result.rows[0].invoiceTax, result.rows[0].ledgerTotal, result.rows[0].invoiceTotal, result.rows[0].delta, result.rows[0].matched], [66.9, 66.9, 676.9, 676.9, 0, true]);
});

test('invoice figures match stored checkout tax and total', function () {
  const checkout = pricing.computeTotals(mixedRateItems, '');
  const invoiceFigures = invoice.computeInvoiceFigures(orderFrom(mixedRateItems, '', { subtotal: checkout.subtotal, discount: checkout.discount, tax: checkout.tax, total: checkout.total }));
  assert.deepEqual([invoiceFigures.tax, invoiceFigures.total], [checkout.tax, checkout.total]);
});
