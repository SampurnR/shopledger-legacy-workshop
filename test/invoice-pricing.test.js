'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

test('invoice figures match order pricing for HSN-coded items and coupons', function () {
  var items = [{ id: 2, name: 'Tea', sku: 'TEA-2', hsn: '0902', price: 6000, qty: 1 }];
  var ledger = pricing.computeTotals(items, 'SAVE10');
  var printedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(printedInvoice.subtotal, ledger.subtotal);
  assert.equal(printedInvoice.discount, ledger.discount);
  assert.equal(printedInvoice.tax, ledger.tax);
  assert.equal(printedInvoice.cgst, ledger.cgst);
  assert.equal(printedInvoice.sgst, ledger.sgst);
  assert.equal(printedInvoice.total, ledger.total);
  assert.equal(printedInvoice.rows[0].gstPercent, ledger.lines[0].gstPercent);
  assert.equal(printedInvoice.rows[0].lineTax, ledger.lines[0].tax);
});

test('invoice applies the configured HSN GST slab when gstRate is absent', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];

  var ledger = pricing.computeTotals(items, '');
  var printedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(printedInvoice.rows[0].gstPercent, 5);
  assert.equal(printedInvoice.tax, ledger.tax);
  assert.equal(printedInvoice.total, ledger.total);
});

test('invoice and pricing interpret gstRate 5 as five percent', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1, gstRate: 5 }];

  var ledger = pricing.computeTotals(items, '');
  var printedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(ledger.tax, 5);
  assert.equal(printedInvoice.rows[0].gstPercent, 5);
  assert.equal(printedInvoice.tax, ledger.tax);
  assert.equal(printedInvoice.total, ledger.total);
});

test('invoice applies the SAVE10 cap to subtotal before calculating GST', function () {
  var items = [{ id: 2, name: 'Tea', hsn: '0902', price: 6000, qty: 1 }];

  var ledger = pricing.computeTotals(items, 'SAVE10');
  var printedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(ledger.discount, 150);
  assert.equal(printedInvoice.discount, ledger.discount);
  assert.equal(printedInvoice.tax, ledger.tax);
  assert.equal(printedInvoice.total, ledger.total);
  assert.equal(printedInvoice.rows[0].lineTax, ledger.lines[0].tax);
});

test('GST reconciliation reports the order and invoice as matched when HSN pricing agrees', function () {
  var order = {
    id: 1001,
    date: '27/11/2026',
    customer: 'In-memory customer',
    coupon: '',
    status: 'completed',
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  };

  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].ledgerTax, 5);
  assert.equal(reconciliation.rows[0].invoiceTax, 5);
  assert.equal(reconciliation.rows[0].ledgerTotal, 105);
  assert.equal(reconciliation.rows[0].invoiceTotal, 105);
  assert.equal(reconciliation.rows[0].matched, true);
});

test('rendered invoice displays the billed total without a reconciliation warning', function () {
  var html = invoice.render({
    id: 1002,
    date: '27/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    coupon: '',
    status: 'completed',
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    total: 105
  });

  assert.match(html, /Invoice Total<\/td><td class="r">[\s\S]*?105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
