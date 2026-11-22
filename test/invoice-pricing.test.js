'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('CORRECT BEHAVIOUR — invoice GST breakdown and total match the order pricing calculation', function () {
  var items = [
    { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 }
  ];
  var totals = pricing.computeTotals(items, 'SAVE10');
  var order = {
    id: 1004,
    items: items,
    coupon: 'SAVE10',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };

  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceFigures.subtotal, totals.subtotal);
  assert.equal(invoiceFigures.discount, totals.discount);
  assert.equal(invoiceFigures.rows[0].gstPercent, totals.lines[0].gstPercent);
  assert.equal(invoiceFigures.rows[0].lineTax, totals.lines[0].tax);
  assert.equal(invoiceFigures.tax, totals.tax);
  assert.equal(invoiceFigures.cgst, totals.cgst);
  assert.equal(invoiceFigures.sgst, totals.sgst);
  assert.equal(invoiceFigures.total, totals.total);
});

test('CURRENT BEHAVIOUR — ledger pricing applies the HSN slab to the post-discount taxable line', function () {
  var items = [
    { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 2000, qty: 1 }
  ];

  var totals = pricing.computeTotals(items, 'SAVE10');

  assert.equal(totals.subtotal, 2000);
  assert.equal(totals.discount, 150); // SAVE10 is capped at ₹150 in coupon logic.
  assert.equal(totals.taxable, 1850);
  assert.equal(totals.tax, 92.5); // HSN 1006 maps to 5% GST.
  assert.equal(totals.cgst, 46.25);
  assert.equal(totals.sgst, 46.25);
  assert.equal(totals.total, 1942.5);
  assert.deepEqual(totals.lines[0], {
    id: 1,
    name: 'Rice',
    hsn: '1006',
    gstPercent: 5,
    gross: 2000,
    discount: 150,
    taxable: 1850,
    tax: 92.5,
    net: 1942.5
  });
});

test('invoice applies the configured HSN slab when gstRate is absent', function () {
  var order = {
    id: 1001,
    items: [
      { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 100, qty: 1 }
    ],
    coupon: ''
  };

  var ledgerFigures = pricing.computeTotals(order.items, '');
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(ledgerFigures.tax, 5);
  assert.equal(ledgerFigures.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, ledgerFigures.tax);
  assert.equal(invoiceFigures.total, ledgerFigures.total);
});

test('invoice uses the capped SAVE10 discount and post-discount taxable amount', function () {
  var items = [
    { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 2000, qty: 1 }
  ];
  var order = {
    id: 1002,
    items: items,
    coupon: 'SAVE10'
  };

  var ledgerFigures = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(ledgerFigures.discount, 150);
  assert.equal(ledgerFigures.total, 1942.5);
  assert.equal(invoiceFigures.tax, ledgerFigures.tax);
  assert.equal(invoiceFigures.discount, ledgerFigures.discount);
  assert.equal(invoiceFigures.total, ledgerFigures.total);
});

test('reconciliation matches invoice and ledger figures for an in-memory order', function () {
  var items = [
    { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 2000, qty: 1 }
  ];
  var totals = pricing.computeTotals(items, 'SAVE10');
  var order = {
    id: 1003,
    date: '22/11/2026',
    customer: 'Test customer',
    coupon: 'SAVE10',
    items: items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };

  var reconciliation = reports.getGstReconciliation({ orders: [order] });
  var html = invoice.render(order);

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].invoiceTax, totals.tax);
  assert.equal(reconciliation.rows[0].invoiceTotal, totals.total);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
