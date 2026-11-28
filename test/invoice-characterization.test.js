'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');
var config = require('../config');

function makeOrder(item, coupon) {
  var totals = pricing.computeTotals([item], coupon);
  return {
    id: 1001,
    date: '01/04/2022',
    customer: 'In-memory customer',
    status: 'completed',
    coupon: coupon,
    items: [item],
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('CURRENT BEHAVIOUR: order pricing uses the HSN slab and applies SAVE10 before GST', function () {
  var item = { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 640, qty: 1 };
  var totals = pricing.computeTotals([item], 'SAVE10');

  assert.equal(totals.subtotal, 640);
  assert.equal(totals.discount, 64);
  assert.equal(totals.tax, 28.8);
  assert.equal(totals.cgst, 14.4);
  assert.equal(totals.sgst, 14.4);
  assert.equal(totals.total, 604.8);
  assert.equal(totals.lines[0].gstPercent, 5);
  assert.equal(totals.lines[0].taxable, 576);
});

test('invoice figures match the order totals and line GST billed to the customer', function () {
  var item = { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 640, qty: 1 };
  var order = makeOrder(item, 'SAVE10');
  var billed = pricing.computeTotals([item], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    lines: figures.rows.map(function (row) {
      return { gstPercent: row.gstPercent, lineTax: row.lineTax };
    })
  }, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total,
    lines: billed.lines.map(function (line) {
      return { gstPercent: line.gstPercent, lineTax: line.tax };
    })
  });
  assert.match(html, /<th class="r">Taxable Value<\/th>/);
  assert.match(html, /<td class="r">5%<\/td><td class="r">[^<]*576\.00<\/td><td class="r">[^<]*28\.80<\/td>/);
});

test('invoice applies the order pricing HSN rate and capped SAVE10 discount', function () {
  var item = { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 2000, qty: 1 };
  var order = makeOrder(item, 'SAVE10');
  var ledgerTotals = pricing.computeTotals([item], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(config.coupons.SAVE10.maxDiscount, 150);
  assert.equal(ledgerTotals.discount, 150);
  assert.equal(ledgerTotals.tax, 92.5);
  assert.equal(ledgerTotals.total, 1942.5);
  assert.equal(figures.discount, ledgerTotals.discount);
  assert.equal(figures.tax, ledgerTotals.tax);
  assert.equal(figures.total, ledgerTotals.total);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 92.5);
});

test('GST reconciliation matches invoice figures to the recorded order totals', function () {
  var item = { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 640, qty: 1 };
  var order = makeOrder(item, 'SAVE10');
  var result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].ledgerTax, 28.8);
  assert.equal(result.rows[0].invoiceTax, 28.8);
  assert.equal(result.rows[0].ledgerTotal, 604.8);
  assert.equal(result.rows[0].invoiceTotal, 604.8);
  assert.equal(result.rows[0].matched, true);
});
