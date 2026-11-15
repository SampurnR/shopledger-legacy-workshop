'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

function billedOrder() {
  var items = [
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, name: 'Tea', sku: 'TEA-1', hsn: '0902', price: 1000, qty: 1 }
  ];
  var ledger = pricing.computeTotals(items, 'SAVE10');

  return {
    id: 42,
    date: '15/11/2026',
    customer: 'Asha',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: 'SAVE10',
    subtotal: ledger.subtotal,
    discount: ledger.discount,
    tax: ledger.tax,
    total: ledger.total
  };
}

test('invoice uses the billed HSN GST and coupon calculations', function () {
  var order = billedOrder();
  var billed = pricing.computeTotals(order.items, order.coupon);
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  }, {
    subtotal: 2000,
    discount: 150,
    tax: 212.75,
    total: 2062.75
  });
  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    total: figures.total,
    rowRates: figures.rows.map(function (row) { return row.gstPercent; })
  }, {
    subtotal: 2000,
    discount: 150,
    tax: 212.75,
    total: 2062.75,
    rowRates: [5, 18]
  });
});

test('invoice CGST and SGST sum to the billed tax', function () {
  var figures = invoice.computeInvoiceFigures(billedOrder());

  assert.equal(figures.tax, 212.75);
  assert.equal(figures.cgst, 106.38);
  assert.equal(figures.sgst, 106.37);
  assert.equal(figures.cgst + figures.sgst, figures.tax);
});

test('invoice HTML shows the billed total without a reconciliation warning', function () {
  var html = invoice.render(billedOrder());

  assert.match(html, /Invoice Total<\/td><td class="r">₹2062\.75/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
});
