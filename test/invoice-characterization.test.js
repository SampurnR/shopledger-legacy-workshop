'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('pricing: mixed HSN lines receive their HSN GST rates on post-discount taxable values', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 9, name: 'Coffee', hsn: '0901', price: 310, qty: 1 }
  ];

  var totals = pricing.computeTotals(items, 'WELCOME');

  assert.deepEqual(totals.lines.map(function (line) {
    return {
      gstPercent: line.gstPercent,
      discount: line.discount,
      taxable: line.taxable,
      tax: line.tax,
      net: line.net
    };
  }), [
    { gstPercent: 5, discount: 32, taxable: 608, tax: 30.4, net: 638.4 },
    { gstPercent: 18, discount: 15.5, taxable: 294.5, tax: 53.01, net: 347.51 }
  ]);
  assert.equal(totals.discount, 47.5);
  assert.equal(totals.tax, 83.41);
  assert.equal(totals.total, 985.91);
});

test('invoice uses HSN 1006 for rice instead of the 18 percent default', function () {
  var order = {
    id: 100,
    coupon: '',
    customer: 'Walk-in',
    paymentMode: 'cash',
    items: [
      { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 }
    ]
  };

  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 32);
  assert.equal(figures.tax, 32);
  assert.equal(figures.total, 672);

  var ledgerTotals = pricing.computeTotals(order.items, '');
  assert.equal(ledgerTotals.lines[0].gstPercent, 5);
  assert.equal(ledgerTotals.tax, 32);
  assert.equal(ledgerTotals.total, 672);
  assert.equal(figures.total, ledgerTotals.total);
});

test('invoice applies SAVE10 against subtotal and the coupon cap', function () {
  var order = {
    id: 101,
    coupon: 'SAVE10',
    customer: 'Walk-in',
    paymentMode: 'cash',
    items: [
      { id: 8, name: 'Tea', sku: 'BEV-001', hsn: '0902', price: 2000, qty: 1 }
    ]
  };

  var figures = invoice.computeInvoiceFigures(order);
  var ledgerTotals = pricing.computeTotals(order.items, 'SAVE10');

  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 333);
  assert.equal(figures.total, 2183);

  assert.equal(ledgerTotals.discount, 150);
  assert.equal(ledgerTotals.tax, 333);
  assert.equal(ledgerTotals.total, 2183);
});

test('invoice normalizes lowercase coupon codes', function () {
  var order = {
    id: 102,
    coupon: 'save10',
    customer: 'Walk-in',
    paymentMode: 'cash',
    items: [
      { id: 8, name: 'Tea', sku: 'BEV-001', hsn: '0902', price: 1000, qty: 1 }
    ]
  };

  var figures = invoice.computeInvoiceFigures(order);
  var ledgerTotals = pricing.computeTotals(order.items, 'save10');

  assert.equal(figures.discount, 100);
  assert.equal(figures.tax, 162);
  assert.equal(figures.total, 1062);

  assert.equal(ledgerTotals.discount, 100);
  assert.equal(ledgerTotals.tax, 162);
  assert.equal(ledgerTotals.total, 1062);
});

test('invoice rejects flat coupons below the minimum order value', function () {
  var order = {
    id: 103,
    coupon: 'FLAT50',
    customer: 'Walk-in',
    paymentMode: 'cash',
    items: [
      { id: 12, name: 'Sherbet', sku: 'BEV-003', hsn: '2106', price: 200, qty: 1 }
    ]
  };

  var figures = invoice.computeInvoiceFigures(order);
  var ledgerTotals = pricing.computeTotals(order.items, 'FLAT50');

  assert.equal(figures.discount, 0);
  assert.equal(figures.tax, 36);
  assert.equal(figures.total, 236);

  assert.equal(ledgerTotals.discount, 0);
  assert.equal(ledgerTotals.tax, 36);
  assert.equal(ledgerTotals.total, 236);
});

test('invoice: an item gstRate overrides the default and HSN lookup', function () {
  var order = {
    id: 104,
    coupon: '',
    customer: 'Walk-in',
    paymentMode: 'cash',
    items: [
      { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', gstRate: 5, price: 640, qty: 1 }
    ]
  };

  var figures = invoice.computeInvoiceFigures(order);
  var ledgerTotals = pricing.computeTotals(order.items, '');

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 32);
  assert.equal(figures.total, 672);
  assert.equal(ledgerTotals.tax, 32);
  assert.equal(ledgerTotals.total, 672);
});

test('correct behaviour: invoice figures match ledger pricing for HSN and coupon', function () {
  var order = {
    id: 105,
    coupon: 'SAVE10',
    customer: 'Walk-in',
    paymentMode: 'cash',
    items: [
      { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 },
      { id: 9, name: 'Coffee', sku: 'BEV-002', hsn: '0901', price: 310, qty: 1 }
    ]
  };

  var ledgerTotals = pricing.computeTotals(order.items, order.coupon);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, ledgerTotals.subtotal);
  assert.equal(figures.discount, ledgerTotals.discount);
  assert.equal(figures.tax, ledgerTotals.tax);
  assert.equal(figures.cgst, ledgerTotals.cgst);
  assert.equal(figures.sgst, ledgerTotals.sgst);
  assert.equal(figures.total, ledgerTotals.total);
});
