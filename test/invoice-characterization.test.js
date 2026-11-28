'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function orderFor(items, coupon) {
  var totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 1,
    date: '28/11/2026',
    customer: 'In-memory test customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice uses the same HSN GST and total as the order bill', function () {
  var order = orderFor([{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 }]);
  var billed = pricing.computeTotals(order.items, order.coupon);
  var printed = invoice.computeInvoiceFigures(order);
  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(billed.tax, 32);
  assert.equal(billed.total, 672);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.rows[0].lineTax, 32);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
  assert.equal(printed.total, billed.total);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});

test('invoice uses the billed SAVE10 discount and post-discount GST', function () {
  var order = orderFor([{ id: 2, name: 'Tea', sku: 'BEV-001', hsn: '0902', price: 1000, qty: 1 }], 'SAVE10');
  var billed = pricing.computeTotals(order.items, order.coupon);
  var printed = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 100);
  assert.equal(billed.tax, 162);
  assert.equal(billed.total, 1062);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.rows[0].lineTax, 162);
  assert.equal(printed.total, billed.total);
});

test('invoice respects the billed SAVE10 maximum discount', function () {
  var order = orderFor([{ id: 3, name: 'Coffee', sku: 'BEV-002', hsn: '0901', price: 2000, qty: 1 }], 'SAVE10');
  var billed = pricing.computeTotals(order.items, order.coupon);
  var printed = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 333);
  assert.equal(billed.total, 2183);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, billed.total);
});

test('invoice applies FLAT50 before calculating GST, as billed', function () {
  var order = orderFor([{ id: 4, name: 'Tea', sku: 'BEV-001', hsn: '0902', price: 1000, qty: 1 }], 'FLAT50');
  var billed = pricing.computeTotals(order.items, order.coupon);
  var printed = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 50);
  assert.equal(billed.tax, 171);
  assert.equal(billed.total, 1121);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, billed.total);
});
