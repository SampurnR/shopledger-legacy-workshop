'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

test('CURRENT BEHAVIOUR: pricing applies proportional coupon discounts before HSN GST', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 200, qty: 1 }
  ];

  var totals = pricing.computeTotals(items, 'WELCOME');

  assert.deepEqual({
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    tax: totals.tax,
    cgst: totals.cgst,
    sgst: totals.sgst,
    total: totals.total
  }, {
    subtotal: 300,
    discount: 15,
    taxable: 285,
    tax: 38.95,
    cgst: 19.48,
    sgst: 19.47,
    total: 323.95
  });
  assert.deepEqual(totals.lines.map(function (line) {
    return [line.gstPercent, line.discount, line.taxable, line.tax];
  }), [
    [5, 5, 95, 4.75],
    [18, 10, 190, 34.2]
  ]);
});

test('FIXED BEHAVIOUR: invoice uses HSN rates and matches the coupon-priced total', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 200, qty: 1 }
  ];
  var orderPricing = pricing.computeTotals(items, 'WELCOME');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.equal(orderPricing.total, 323.95);
  assert.equal(figures.subtotal, orderPricing.subtotal);
  assert.equal(figures.discount, orderPricing.discount);
  assert.deepEqual(figures.rows.map(function (line) { return line.gstPercent; }), [5, 18]);
  assert.equal(figures.tax, orderPricing.tax);
  assert.equal(figures.discount, orderPricing.discount);
  assert.equal(figures.cgst, orderPricing.cgst);
  assert.equal(figures.sgst, orderPricing.sgst);
  assert.equal(figures.total, orderPricing.total);
});

test('FIXED BEHAVIOUR: invoice honors the SAVE10 cap and matches the billed order', function () {
  var items = [{ id: 1, name: 'Tea', hsn: '0902', price: 2000, qty: 1 }];
  var orderPricing = pricing.computeTotals(items, 'SAVE10');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(orderPricing.discount, 150);
  assert.equal(orderPricing.tax, 333);
  assert.equal(orderPricing.total, 2183);
  assert.equal(figures.tax, orderPricing.tax);
  assert.equal(figures.discount, orderPricing.discount);
  assert.equal(figures.cgst, orderPricing.cgst);
  assert.equal(figures.sgst, orderPricing.sgst);
  assert.equal(figures.total, orderPricing.total);
});

test('FIXED BEHAVIOUR: invoice preserves explicit zero and percentage GST rates', function () {
  var items = [
    { name: 'Zero-rated item', price: 100, qty: 1, gstRate: 0 },
    { name: 'Five percent item', price: 100, qty: 1, gstRate: 5 }
  ];
  var totals = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({
    items: items,
    coupon: ''
  });

  assert.deepEqual(figures.rows.map(function (line) { return line.gstPercent; }), [0, 5]);
  assert.deepEqual(figures.rows.map(function (line) { return line.lineTax; }), [0, 5]);
  assert.equal(figures.tax, totals.tax);
  assert.equal(figures.cgst, totals.cgst);
  assert.equal(figures.sgst, totals.sgst);
  assert.equal(figures.total, totals.total);
});

test('FIXED BEHAVIOUR: matching billed GST and total reconcile without an invoice warning', function () {
  var order = {
    id: 42,
    date: '01/01/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    coupon: '',
    items: [{ id: 1, name: 'Rice', hsn: '1006', sku: 'RICE-1', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  };

  var reconciliation = reports.getGstReconciliation({ orders: [order] });
  var html = invoice.render(order);

  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
  assert.equal(reconciliation.rows[0].invoiceTax, 5);
  assert.equal(reconciliation.rows[0].ledgerTax, 5);
  assert.equal(html.includes('Accountant Reconciliation Notice'), false);
});
