'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');
var config = require('../config');

// All fixtures are in-memory; tests never read or write data/db.json.
var mixedHsnOrder = {
  id: 2001,
  date: '22/11/2026',
  customer: 'In-memory customer',
  coupon: 'SAVE10',
  subtotal: 1020,
  discount: 102,
  tax: 45.9,
  total: 963.9,
  items: [
    { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 2, sku: 'OIL-1', name: 'Oil', hsn: '1512', price: 190, qty: 2 }
  ]
};

test('CURRENT BEHAVIOUR — pricing applies HSN rates after a proportional coupon discount', function () {
  var totals = pricing.computeTotals(mixedHsnOrder.items, mixedHsnOrder.coupon);

  assert.deepEqual({
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    tax: totals.tax,
    cgst: totals.cgst,
    sgst: totals.sgst,
    total: totals.total
  }, {
    subtotal: 1020,
    discount: 102,
    taxable: 918,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9
  });
  assert.deepEqual(totals.lines.map(function (line) { return line.gstPercent; }), [5, 5]);
});

test('invoice matches billed figures and HSN line rates', function () {
  var billed = pricing.computeTotals(mixedHsnOrder.items, mixedHsnOrder.coupon);
  var figures = invoice.computeInvoiceFigures(mixedHsnOrder);

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total
  }, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total
  });
  assert.deepEqual(figures.rows.map(function (row) {
    return { gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), [
    { gstPercent: 5, lineTax: 28.8 },
    { gstPercent: 5, lineTax: 17.1 }
  ]);
});

test('invoice applies the same SAVE10 cap and totals as order pricing', function () {
  var items = [{ id: 3, name: 'Tea', hsn: '0902', price: 2240, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual({ discount: billed.discount, tax: billed.tax, total: billed.total }, {
    discount: 150,
    tax: 376.2,
    total: 2466.2
  });
  assert.deepEqual({ discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total }, {
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });
});

test('historical invoice preserves its recorded discount after coupon deactivation', function () {
  var active = config.coupons.SAVE10.active;
  config.coupons.SAVE10.active = false;

  try {
    var figures = invoice.computeInvoiceFigures(mixedHsnOrder);
    assert.equal(figures.discount, mixedHsnOrder.discount);
    assert.equal(figures.tax, mixedHsnOrder.tax);
    assert.equal(figures.total, mixedHsnOrder.total);
  } finally {
    config.coupons.SAVE10.active = active;
  }
});

test('GST reconciliation matches the in-memory billed order', function () {
  var result = reports.getGstReconciliation({ orders: [mixedHsnOrder] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].matched, true);
  assert.equal(result.rows[0].ledgerTax, 45.9);
  assert.equal(result.rows[0].invoiceTax, 45.9);
  assert.equal(result.rows[0].delta, 0);
});
