'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function billedOrder(items, coupon) {
  var totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 41,
    date: '2026-11-15',
    customer: 'In-memory customer',
    coupon: coupon || '',
    items: items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('checkout and invoice use the same HSN rate, GST breakdown, and total', function () {
  var order = billedOrder([
    { id: 5, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 2 }
  ]);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.subtotal, order.subtotal);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.cgst, 5);
  assert.equal(figures.sgst, 5);
  assert.equal(figures.total, order.total);
});

test('reconciliation reports a match for the HSN-based billed order', function () {
  var order = billedOrder([
    { id: 2, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 2 }
  ]);
  var result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].ledgerTax, 10);
  assert.equal(result.rows[0].invoiceTax, 10);
  assert.equal(result.rows[0].invoiceTotal, 210);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});

test('invoice uses the checkout percentage coupon cap and post-discount GST', function () {
  var order = billedOrder([
    { id: 3, name: 'Bulk goods', sku: 'BULK', hsn: '9999', price: 2000, qty: 1 }
  ], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 150);
  assert.equal(order.tax, 333);
  assert.equal(order.total, 2183);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 333);
  assert.equal(figures.cgst, 166.5);
  assert.equal(figures.sgst, 166.5);
  assert.equal(figures.total, 2183);
});

test('invoice render shows the billed total without a reconciliation notice', function () {
  var order = billedOrder([
    { id: 4, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 2 }
  ]);
  var html = invoice.render(order);

  assert.match(html, /Invoice Total<\/td><td class="r">[^0-9]*210\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
