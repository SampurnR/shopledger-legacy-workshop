'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('invoice uses the HSN slab persisted on order lines', function () {
  // This is the shape persisted by routes/orders.js: HSN is present, gstRate is not.
  var items = [{
    id: 1,
    sku: 'GRN-001',
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 1
  }];
  var billed = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(billed.lines[0].gstPercent, 5);
  assert.equal(invoiceFigures.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(invoiceFigures.rows[0].lineTax, billed.lines[0].tax);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice applies the validated coupon discount to the subtotal and respects its cap', function () {
  // Ten rice bags qualify for SAVE10; its configured maximum discount is ₹150.
  var items = [{
    id: 1,
    sku: 'GRN-001',
    name: 'Rice',
    hsn: '1006',
    price: 640,
    qty: 10
  }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var order = {
    id: 1001,
    items: items,
    coupon: 'SAVE10',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 312.5);
  assert.equal(billed.total, 6562.5);
  assert.equal(invoiceFigures.subtotal, billed.subtotal);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);

  var html = invoice.render(order);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
