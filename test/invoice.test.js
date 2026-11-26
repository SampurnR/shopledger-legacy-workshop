'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function billedOrder(items, coupon) {
  var totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 1,
    date: '2026-11-26',
    customer: 'Test Customer',
    paymentMode: 'cash',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice uses the HSN GST slab used for billing', function () {
  var order = billedOrder([
    { id: 10, name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ]);
  var invoiceFigures = invoice.computeInvoiceFigures(order);
  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(order.subtotal, 100);
  assert.equal(order.tax, 5);
  assert.equal(order.total, 105);
  assert.equal(invoiceFigures.tax, order.tax);
  assert.equal(invoiceFigures.cgst, 2.5);
  assert.equal(invoiceFigures.sgst, 2.5);
  assert.equal(invoiceFigures.total, order.total);
  assert.equal(reconciliation.rows[0].matched, true);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.match(invoice.render(order), /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice applies flat coupon discount before calculating GST', function () {
  var order = billedOrder([
    { id: 20, name: 'Unclassified product', price: 400, qty: 1 }
  ], 'FLAT50');
  var invoiceFigures = invoice.computeInvoiceFigures(order);
  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(order.subtotal, 400);
  assert.equal(order.discount, 50);
  assert.equal(order.tax, 63);
  assert.equal(order.total, 413);
  assert.equal(invoiceFigures.discount, 50);
  assert.equal(invoiceFigures.tax, 63);
  assert.equal(invoiceFigures.total, order.total);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
