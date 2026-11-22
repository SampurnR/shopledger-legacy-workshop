'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var coupons = require('../lib/coupons');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');
var tax = require('../lib/tax');

function item(overrides) {
  return Object.assign({
    id: 1,
    sku: 'TEST-001',
    name: 'In-memory test item',
    hsn: '1006',
    price: 100,
    qty: 1
  }, overrides || {});
}

function order(id, items, coupon, ledgerTotals) {
  return Object.assign({
    id: id,
    date: '01/01/2022',
    customer: 'Characterization fixture',
    status: 'completed',
    items: items,
    coupon: coupon || ''
  }, ledgerTotals || {});
}

test('tax resolves explicit percentage, decimal, HSN slab, and default rates', function () {
  assert.equal(tax.getRateForItem({ gstRate: 12 }), 0.12);
  assert.equal(tax.getRateForItem({ gstRate: 0.05 }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: '1006' }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: '0405' }), 0.12);
  assert.equal(tax.getRateForItem({ hsn: 'UNKNOWN' }), 0.18);
});

test('checkout coupon rules enforce percentage caps, flat values, and minimum spend', function () {
  assert.equal(coupons.calculateDiscount(2240, 'SAVE10'), 150);
  assert.equal(coupons.calculateDiscount(400, 'FLAT50'), 50);
  assert.equal(coupons.calculateDiscount(299, 'FLAT50'), 0);

  var belowMinimum = coupons.validate('SAVE10', 499);
  assert.equal(belowMinimum.valid, false);
  assert.match(belowMinimum.error, /minimum order subtotal/);
});

test('checkout computes GST from discounted taxable value', function () {
  var totals = pricing.computeTotals([item({ price: 1000, hsn: '1006' })], 'SAVE10');

  assert.deepEqual(totals, {
    subtotal: 1000,
    discount: 100,
    taxable: 900,
    tax: 45,
    cgst: 22.5,
    sgst: 22.5,
    total: 945,
    lines: [{
      id: 1,
      name: 'In-memory test item',
      hsn: '1006',
      gstPercent: 5,
      gross: 1000,
      discount: 100,
      taxable: 900,
      tax: 45,
      net: 945
    }]
  });
});

test('invoice calculates GST after the percentage discount', function () {
  var figures = invoice.computeInvoiceFigures(order(1, [item({ price: 1000, gstRate: 5 })], 'SAVE10'));

  // Discount is 100, then GST is 900 * 5% = 45.
  assert.equal(figures.subtotal, 1000);
  assert.equal(figures.tax, 45);
  assert.equal(figures.discount, 100);
  assert.equal(figures.total, 945);
});

test('invoice respects coupon minimum spend for a flat coupon', function () {
  var figures = invoice.computeInvoiceFigures(order(2, [item({ price: 100, gstRate: 5 })], 'FLAT50'));

  // FLAT50 has a 300 minimum, so it does not apply.
  assert.equal(figures.subtotal, 100);
  assert.equal(figures.tax, 5);
  assert.equal(figures.discount, 0);
  assert.equal(figures.total, 105);
});

test('Issue #1 Order #1002 invoice matches checkout', function () {
  var items = [item({ name: 'Order #1002 5% GST fixture', price: 1020, hsn: '1006' })];
  var checkout = pricing.computeTotals(items, 'SAVE10');
  var savedOrder = order(1002, items, 'SAVE10', checkout);
  var figures = invoice.computeInvoiceFigures(savedOrder);

  // Checkout: 1020 - 102 discount = 918 taxable; 5% GST = 45.90.
  assert.equal(checkout.discount, 102);
  assert.equal(checkout.tax, 45.9);
  assert.equal(checkout.total, 963.9);

  assert.equal(figures.tax, 45.9);
  assert.equal(figures.discount, 102);
  assert.equal(figures.total, 963.9);
});

test('Issue #1 Order #1004 invoice respects SAVE10 cap and HSN rate', function () {
  var items = [item({ name: 'Groundnut oil fixture', price: 1120, qty: 2, hsn: '1508' })];
  var checkout = pricing.computeTotals(items, 'SAVE10');
  var savedOrder = order(1004, items, 'SAVE10', checkout);
  var figures = invoice.computeInvoiceFigures(savedOrder);

  // Checkout caps SAVE10 at 150, then charges 5% GST on 2240 - 150.
  assert.equal(checkout.subtotal, 2240);
  assert.equal(checkout.discount, 150);
  assert.equal(checkout.tax, 104.5);
  assert.equal(checkout.total, 2194.5);

  assert.equal(figures.tax, 104.5);
  assert.equal(figures.discount, 150);
  assert.equal(figures.total, 2194.5);
});

test('non-coupon 5% and 12% HSN items retain their invoice rates', function () {
  var fivePercent = item({ id: 5, hsn: '1006', price: 100 });
  var twelvePercent = item({ id: 12, hsn: '0405', price: 100 });

  assert.equal(pricing.computeTotals([fivePercent], '').tax, 5);
  assert.equal(invoice.computeInvoiceFigures(order(5, [fivePercent], '')).tax, 5);

  assert.equal(pricing.computeTotals([twelvePercent], '').tax, 12);
  assert.equal(invoice.computeInvoiceFigures(order(12, [twelvePercent], '')).tax, 12);
});

test('invoice honors an explicit gstRate on an order line', function () {
  var figures = invoice.computeInvoiceFigures(order(18, [item({ price: 200, gstRate: 12 })], ''));

  assert.equal(figures.rows[0].gstPercent, 12);
  assert.equal(figures.tax, 24);
  assert.equal(figures.total, 224);
});

test('reconciliation matches Issue #1 totals and tax', function () {
  var items1002 = [item({ name: 'Order #1002 fixture', price: 1020, hsn: '1006' })];
  var items1004 = [item({ name: 'Order #1004 fixture', price: 1120, qty: 2, hsn: '1508' })];
  var order1002 = order(1002, items1002, 'SAVE10', pricing.computeTotals(items1002, 'SAVE10'));
  var order1004 = order(1004, items1004, 'SAVE10', pricing.computeTotals(items1004, 'SAVE10'));

  var result = reports.getGstReconciliation({ orders: [order1002, order1004] });

  assert.equal(result.totalChecked, 2);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows.map(function (row) {
    return {
      orderId: row.orderId,
      invoiceTax: row.invoiceTax,
      invoiceTotal: row.invoiceTotal,
      delta: row.delta,
      matched: row.matched
    };
  }), [
    { orderId: 1002, invoiceTax: 45.9, invoiceTotal: 963.9, delta: 0, matched: true },
    { orderId: 1004, invoiceTax: 104.5, invoiceTotal: 2194.5, delta: 0, matched: true }
  ]);
});
