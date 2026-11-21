'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

test('CURRENT BEHAVIOUR: order pricing uses HSN slabs and applies WELCOME discount before GST', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ];

  var billed = pricing.computeTotals(items, 'WELCOME');
  var invoiceFigures = invoice.computeInvoiceFigures({
    items: items,
    coupon: 'WELCOME'
  });

  assert.equal(billed.subtotal, 200);
  assert.equal(billed.discount, 10);
  assert.equal(billed.tax, 21.85);
  assert.equal(billed.cgst, 10.93);
  assert.equal(billed.sgst, 10.92);
  assert.equal(billed.total, 211.85);
  assert.deepEqual(billed.lines.map(function (line) { return line.gstPercent; }), [5, 18]);

  // Order lines store HSN but not gstRate. The invoice therefore uses the
  // configured default rate and computes the percentage coupon on subtotal + tax.
  assert.equal(invoiceFigures.subtotal, 200);
  assert.equal(invoiceFigures.discount, 11.8);
  assert.equal(invoiceFigures.tax, 36);
  assert.equal(invoiceFigures.cgst, 18);
  assert.equal(invoiceFigures.sgst, 18);
  assert.equal(invoiceFigures.total, 224.2);
  assert.deepEqual(invoiceFigures.rows.map(function (line) { return line.gstPercent; }), [18, 18]);
});

test('CURRENT BEHAVIOUR: invoice ignores SAVE10 minimum cap and taxes the undiscounted subtotal', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }
  ];

  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({
    id: 77,
    date: '21/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: 'SAVE10',
    total: billed.total
  });

  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 92.5);
  assert.equal(billed.total, 1942.5);

  assert.equal(invoiceFigures.discount, 236);
  assert.equal(invoiceFigures.tax, 360);
  assert.equal(invoiceFigures.total, 2124);

  var html = invoice.render({
    id: 77,
    date: '21/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: 'SAVE10',
    total: billed.total
  });
  assert.match(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice computed total/);
});

test('CURRENT BEHAVIOUR: GST reconciliation reports invoice versus billed-total variance', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, 'WELCOME');
  var order = {
    id: 78,
    date: '21/11/2026',
    customer: 'In-memory customer',
    coupon: 'WELCOME',
    items: items,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };

  var reconciliation = reports.getGstReconciliation({
    orders: [order],
    products: [],
    customers: []
  });

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 1);
  assert.equal(reconciliation.totalDelta, 12.35);
  assert.equal(reconciliation.rows[0].invoiceTax, 36);
  assert.equal(reconciliation.rows[0].invoiceTotal, 224.2);
  assert.equal(reconciliation.rows[0].delta, 12.35);
  assert.equal(reconciliation.rows[0].matched, false);
});
