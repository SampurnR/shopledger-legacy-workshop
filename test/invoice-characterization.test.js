'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

// Fixtures stay in memory; these tests never access data/db.json.
function currentOrderFixture() {
  var items = [{
    id: 1,
    sku: 'GRN-001',
    name: 'Rice',
    hsn: '1006',
    price: 2000,
    qty: 1
  }];
  var billed = pricing.computeTotals(items, 'SAVE10');

  return {
    id: 1001,
    date: '01/01/2025',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: 'SAVE10',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
}

test('CURRENT BEHAVIOUR: order pricing uses the HSN rate and caps SAVE10 before calculating GST', function () {
  var order = currentOrderFixture();

  assert.equal(order.subtotal, 2000);
  assert.equal(order.discount, 150);
  assert.equal(order.tax, 92.5);
  assert.equal(order.total, 1942.5);
});

test('INVOICE BEHAVIOUR: invoice uses the checkout HSN rate and capped coupon discount', function () {
  var order = currentOrderFixture();
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, 2000);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 92.5);
  assert.equal(figures.cgst, 46.25);
  assert.equal(figures.sgst, 46.25);
  assert.equal(figures.total, 1942.5);
});

test('INVOICE BEHAVIOUR: GST reconciliation matches checkout totals', function () {
  var order = currentOrderFixture();
  var result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].ledgerTax, 92.5);
  assert.equal(result.rows[0].invoiceTax, 92.5);
  assert.equal(result.rows[0].ledgerTotal, 1942.5);
  assert.equal(result.rows[0].invoiceTotal, 1942.5);
  assert.equal(result.rows[0].matched, true);
});

test('INVOICE BEHAVIOUR: rendered invoice displays the checkout total without a reconciliation warning', function () {
  var order = currentOrderFixture();
  var html = invoice.render(order);

  assert.match(html, /<td class="r">5%<\/td>/);
  assert.match(html, /<td>Invoice Total<\/td><td class="r">[^<]*1942\.50/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});

test('INVOICE BEHAVIOUR: four-unit SAVE10 invoice matches checkout including split GST', function () {
  var items = [{
    id: 1,
    sku: 'GRN-001',
    name: 'Indrayani Basmati Rice 5kg',
    hsn: '1006',
    price: 640,
    qty: 4
  }];
  var checkout = pricing.computeTotals(items, 'SAVE10');
  var order = {
    id: 1009,
    date: '28/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: 'SAVE10',
    subtotal: checkout.subtotal,
    discount: checkout.discount,
    tax: checkout.tax,
    total: checkout.total
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    lineGstPercent: figures.rows[0].gstPercent,
    lineTax: figures.rows[0].lineTax
  }, {
    discount: checkout.discount,
    tax: checkout.tax,
    cgst: checkout.cgst,
    sgst: checkout.sgst,
    total: checkout.total,
    lineGstPercent: checkout.lines[0].gstPercent,
    lineTax: checkout.lines[0].tax
  });
});
