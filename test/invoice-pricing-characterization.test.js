'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

var mixedHsnItems = [
  { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 640, qty: 1 },
  { id: 8, sku: 'BEV-001', name: 'Tea', hsn: '0902', price: 140, qty: 1 }
];

test('CURRENT BEHAVIOUR: pricing apportions SAVE10 and uses HSN-specific GST', function () {
  var totals = pricing.computeTotals(mixedHsnItems, 'SAVE10');

  assert.equal(totals.subtotal, 780);
  assert.equal(totals.discount, 78);
  assert.equal(totals.taxable, 702);
  assert.equal(totals.tax, 51.48);
  assert.equal(totals.cgst, 25.74);
  assert.equal(totals.sgst, 25.74);
  assert.equal(totals.total, 753.48);

  assert.deepEqual(totals.lines.map(function (line) {
    return {
      hsn: line.hsn,
      gstPercent: line.gstPercent,
      discount: line.discount,
      taxable: line.taxable,
      tax: line.tax
    };
  }), [
    { hsn: '1006', gstPercent: 5, discount: 64, taxable: 576, tax: 28.8 },
    { hsn: '0902', gstPercent: 18, discount: 14, taxable: 126, tax: 22.68 }
  ]);
});

test('CURRENT BEHAVIOUR: invoice uses HSN-specific GST instead of the 18 percent fallback', function () {
  var figures = invoice.computeInvoiceFigures({
    id: 1001,
    coupon: '',
    items: mixedHsnItems
  });

  assert.equal(figures.subtotal, 780);
  assert.equal(figures.discount, 0);
  assert.equal(figures.tax, 57.2);
  assert.equal(figures.cgst, 28.6);
  assert.equal(figures.sgst, 28.6);
  assert.equal(figures.total, 837.2);

  assert.deepEqual(figures.rows.map(function (row) {
    return { gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), [
    { gstPercent: 5, lineTax: 32 },
    { gstPercent: 18, lineTax: 25.2 }
  ]);
});

test('CURRENT BEHAVIOUR: invoice uses the billed SAVE10 discount and GST', function () {
  var billed = pricing.computeTotals(mixedHsnItems, 'SAVE10');
  var figures = invoice.computeInvoiceFigures({
    id: 1002,
    coupon: 'SAVE10',
    items: mixedHsnItems
  });

  assert.equal(figures.subtotal, billed.subtotal);
  assert.equal(figures.discount, billed.discount);
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.cgst, billed.cgst);
  assert.equal(figures.sgst, billed.sgst);
  assert.equal(figures.total, billed.total);
  assert.equal(figures.discount, 78);
  assert.equal(figures.tax, 51.48);
  assert.equal(figures.total, 753.48);
});

test('CURRENT BEHAVIOUR: an inactive invoice coupon receives no discount', function () {
  var billed = pricing.computeTotals(mixedHsnItems, 'DIWALI20');
  var figures = invoice.computeInvoiceFigures({
    id: 1003,
    coupon: 'DIWALI20',
    items: mixedHsnItems
  });

  assert.equal(billed.discount, 0);
  assert.equal(figures.discount, 0);
  assert.equal(figures.total, billed.total);
});

test('CURRENT BEHAVIOUR: invoice and pricing both honor an explicit gstRate override', function () {
  var item = { id: 1, name: 'Override', hsn: '1006', gstRate: 12, price: 100, qty: 1 };

  var invoiceFigures = invoice.computeInvoiceFigures({
    id: 1004,
    coupon: '',
    items: [item]
  });
  var pricingTotals = pricing.computeTotals([item], '');

  assert.equal(invoiceFigures.tax, 12);
  assert.equal(invoiceFigures.rows[0].gstPercent, 12);
  assert.equal(pricingTotals.tax, 12);
  assert.equal(pricingTotals.lines[0].gstPercent, 12);
});

test('CURRENT BEHAVIOUR: GST reconciliation matches the mixed-HSN billed total', function () {
  var billed = pricing.computeTotals(mixedHsnItems, 'SAVE10');
  var db = {
    orders: [{
      id: 1005,
      date: '28/11/2026',
      customer: 'Test Customer',
      coupon: 'SAVE10',
      items: mixedHsnItems,
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total,
      status: 'completed'
    }]
  };

  var reconciliation = reports.getGstReconciliation(db);

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].ledgerTotal, 753.48);
  assert.equal(reconciliation.rows[0].invoiceTotal, 753.48);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});

test('CURRENT BEHAVIOUR: invoice render shows no mismatch banner for the billed total', function () {
  var billed = pricing.computeTotals(mixedHsnItems, 'SAVE10');
  var order = {
    id: 1006,
    date: '28/11/2026',
    customer: 'Test Customer',
    paymentMode: 'cash',
    status: 'completed',
    coupon: 'SAVE10',
    items: mixedHsnItems,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };

  var html = invoice.render(order);

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹753\.48/);
  assert.match(html, /-₹78\.00/);
});
