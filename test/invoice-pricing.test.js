'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('CURRENT BEHAVIOUR: order pricing uses HSN GST and applies WELCOME before tax', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }
  ];

  assert.deepEqual(pricing.computeTotals(items, 'WELCOME'), {
    subtotal: 1000,
    discount: 50,
    taxable: 950,
    tax: 47.5,
    cgst: 23.75,
    sgst: 23.75,
    total: 997.5,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 1000,
      discount: 50,
      taxable: 950,
      tax: 47.5,
      net: 997.5
    }]
  });
});

test('invoice figures match billed GST and coupon totals across HSN rates', function () {
  var items = [
    { id: 1, name: 'Rice', sku: 'R-1', hsn: '1006', price: 640, qty: 1 },
    { id: 2, name: 'Butter', sku: 'B-1', hsn: '0405', price: 100, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, 'WELCOME');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.equal(invoiced.subtotal, billed.subtotal);
  assert.equal(invoiced.discount, billed.discount);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.cgst, billed.cgst);
  assert.equal(invoiced.sgst, billed.sgst);
  assert.equal(invoiced.total, billed.total);
  assert.deepEqual(invoiced.rows.map(function (row) { return row.gstPercent; }), [5, 12]);
  assert.deepEqual(invoiced.rows.map(function (row) { return row.lineTax; }), [30.4, 11.4]);
});

test('invoice uses the HSN rate when gstRate is absent', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ id: 1, name: 'Rice', sku: 'R-1', hsn: '1006', price: 100, qty: 1 }]
  });

  assert.equal(figures.subtotal, 100);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 5);
});

test('invoice applies coupon cap to subtotal before calculating GST', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 3000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'WELCOME');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.equal(billed.discount, 100);
  assert.equal(billed.tax, 145);
  assert.equal(billed.total, 3045);
  assert.equal(invoiced.discount, billed.discount);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.total, billed.total);
});

test('GST reconciliation matches the invoice and ledger in memory', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'R-1', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var order = {
    id: 123,
    date: '22/11/2026',
    customer: 'Example',
    coupon: '',
    status: 'completed',
    items: items,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
  var result = reports.getGstReconciliation({
    orders: [order],
    products: [],
    customers: []
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].ledgerTax, 5);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[0].ledgerTotal, 105);
  assert.equal(result.rows[0].invoiceTotal, 105);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});
