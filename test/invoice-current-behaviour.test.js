'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var config = require('../config');
var coupons = require('../lib/coupons');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

// Mirrors the order-line shape saved by routes/orders.js. It has HSN but no gstRate.
var items = [
  { id: 1, sku: 'GRA-001', name: 'Rice', hsn: '1006', price: 100, qty: 2 },
  { id: 2, sku: 'DRY-001', name: 'Ghee', hsn: '0405', price: 450, qty: 1 }
];

var recordedOrder = {
  id: 1001,
  date: '15/03/2022',
  customer: 'Walk-in',
  paymentMode: 'cash',
  status: 'completed',
  items: items,
  coupon: 'WELCOME',
  subtotal: 650,
  discount: 32.5,
  tax: 60.8,
  total: 678.3
};

test('CURRENT BEHAVIOUR: invoice total and GST breakdown match the recorded order pricing', function () {
  var billed = pricing.computeTotals(recordedOrder.items, recordedOrder.coupon);
  var figures = invoice.computeInvoiceFigures(recordedOrder);

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    lineRates: figures.rows.map(function (row) { return row.gstPercent; }),
    lineTaxes: figures.rows.map(function (row) { return row.lineTax; })
  }, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total,
    lineRates: billed.lines.map(function (line) { return line.gstPercent; }),
    lineTaxes: billed.lines.map(function (line) { return line.tax; })
  });
});

test('CURRENT BEHAVIOUR: invoice uses each HSN GST slab for HSN-only order lines', function () {
  var figures = invoice.computeInvoiceFigures(recordedOrder);

  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [5, 12]);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [9.5, 51.3]);
  assert.equal(figures.tax, 60.8);
  assert.equal(figures.cgst, 30.4);
  assert.equal(figures.sgst, 30.4);
});

test('CURRENT BEHAVIOUR: invoice applies the recorded coupon discount before GST', function () {
  var figures = invoice.computeInvoiceFigures(recordedOrder);

  assert.equal(recordedOrder.discount, 32.5);
  assert.equal(recordedOrder.tax, 60.8);
  assert.equal(recordedOrder.total, 678.3);
  assert.equal(figures.discount, 32.5);
  assert.equal(figures.total, 678.3);
});

test('CURRENT BEHAVIOUR: invoice coupon calculation honors order minimum and discount cap', function () {
  var belowMinimum = { coupon: 'SAVE10', items: [{ price: 100, qty: 1 }] };
  var overCap = { coupon: 'SAVE10', items: [{ price: 2000, qty: 1 }] };

  assert.equal(coupons.validate('SAVE10', 100).valid, false);
  assert.equal(invoice.computeInvoiceFigures(belowMinimum).discount, 0);
  assert.equal(config.coupons.SAVE10.maxDiscount, 150);
  assert.equal(invoice.computeInvoiceFigures(overCap).discount, 150);
});

test('CURRENT BEHAVIOUR: reconciliation matches invoice figures against the recorded order', function () {
  var result = reports.getGstReconciliation({ orders: [recordedOrder] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual({
    ledgerTax: result.rows[0].ledgerTax,
    invoiceTax: result.rows[0].invoiceTax,
    ledgerTotal: result.rows[0].ledgerTotal,
    invoiceTotal: result.rows[0].invoiceTotal,
    delta: result.rows[0].delta,
    matched: result.rows[0].matched
  }, {
    ledgerTax: 60.8,
    invoiceTax: 60.8,
    ledgerTotal: 678.3,
    invoiceTotal: 678.3,
    delta: 0,
    matched: true
  });
});

test('CURRENT BEHAVIOUR: printable invoice renders billed GST and omits the mismatch notice', function () {
  var html = invoice.render(recordedOrder);

  assert.match(html, /5%/);
  assert.match(html, /678\.30/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});
