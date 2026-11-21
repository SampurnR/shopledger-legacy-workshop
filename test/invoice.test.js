'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

test('invoice uses billed HSN slabs and applies WELCOME discount before GST', function () {
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

  assert.equal(invoiceFigures.subtotal, 200);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
  assert.deepEqual(invoiceFigures.rows.map(function (line) { return line.gstPercent; }), [5, 18]);
});

test('invoice matches billed SAVE10 cap and discounted taxable amount', function () {
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

  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);

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
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('GST reconciliation reports no variance when invoice matches the billed figures', function () {
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
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].invoiceTax, billed.tax);
  assert.equal(reconciliation.rows[0].invoiceTotal, billed.total);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
