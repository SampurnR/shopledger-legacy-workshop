'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

test('invoice figures match the billed amount, coupon, and HSN GST breakdown', function () {
  var items = [
    { id: 1, name: 'Rice', sku: 'R-1', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, name: 'Coffee', sku: 'C-1', hsn: '0901', price: 1000, qty: 1 }
  ];
  var order = { id: 6, items: items, coupon: 'SAVE10' };
  var billed = pricing.computeTotals(items, 'SAVE10');

  var invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(invoiced.subtotal, billed.subtotal);
  assert.equal(invoiced.discount, billed.discount);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.cgst, billed.cgst);
  assert.equal(invoiced.sgst, billed.sgst);
  assert.equal(invoiced.total, billed.total);
  assert.deepEqual(invoiced.rows.map(function (line) {
    return { gstPercent: line.gstPercent, lineTax: line.lineTax };
  }), [
    { gstPercent: 5, lineTax: 46.25 },
    { gstPercent: 18, lineTax: 166.5 }
  ]);
});

test('invoice uses the same HSN GST slab as the billed order', function () {
  var order = {
    id: 1,
    items: [{ id: 1, name: 'Rice', sku: 'R-1', hsn: '1006', price: 100, qty: 1 }],
    coupon: ''
  };

  var billed = pricing.computeTotals(order.items, '');
  var invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(invoiced.rows[0].gstPercent, 5);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.total, billed.total);
});

test('invoice percentage coupon uses the billed discount cap and post-discount GST', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, name: 'Coffee', hsn: '0901', price: 1000, qty: 1 }
  ];
  var order = { id: 2, items: items, coupon: 'SAVE10' };

  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 212.75);
  assert.equal(billed.total, 2062.75);
  assert.equal(invoiced.discount, billed.discount);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.total, billed.total);
});

test('invoice does not apply a flat coupon below its minimum order subtotal', function () {
  var order = {
    id: 3,
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: 'FLAT50'
  };

  var billed = pricing.computeTotals(order.items, 'FLAT50');
  var invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 0);
  assert.equal(billed.total, 105);
  assert.equal(invoiced.discount, billed.discount);
  assert.equal(invoiced.total, billed.total);
});

test('printable invoice displays billed figures without a mismatch notice when figures agree', function () {
  var order = {
    id: 4,
    date: '21/11/2026',
    customer: 'Walk-in',
    paymentMode: 'cash',
    items: [{ id: 1, name: 'Rice', sku: 'R-1', hsn: '1006', price: 100, qty: 1 }],
    coupon: '',
    total: 105
  };

  var html = invoice.render(order);

  assert.match(html, /GST Amt/);
  assert.match(html, /₹5\.00/);
  assert.match(html, /Invoice Total/);
  assert.match(html, /₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('GST reconciliation reports matching invoice and stored order figures', function () {
  var order = {
    id: 5,
    date: '21/11/2026',
    customer: 'Walk-in',
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: '',
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  };

  var result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].ledgerTax, 5);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[0].ledgerTotal, 105);
  assert.equal(result.rows[0].invoiceTotal, 105);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});
