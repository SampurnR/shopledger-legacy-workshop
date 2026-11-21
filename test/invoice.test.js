'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

// These fixtures mirror the item shape saved by routes/orders.js. They are
// deliberately in-memory and do not involve the JSON store.
test('invoice uses the same HSN slab as pricing', function () {
  var order = {
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }],
    coupon: ''
  };

  var ledgerFigures = pricing.computeTotals(order.items, order.coupon);
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(ledgerFigures.tax, 5);
  assert.equal(ledgerFigures.total, 105);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
});

test('invoice interprets decimal gstRate the same way as pricing', function () {
  var order = {
    items: [{ name: 'Sample', price: 100, qty: 1, gstRate: 0.05 }],
    coupon: ''
  };

  var ledgerFigures = pricing.computeTotals(order.items, order.coupon);
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(ledgerFigures.tax, 5);
  assert.equal(ledgerFigures.total, 105);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
});

test('invoice applies coupon discount to taxable value before tax, like pricing', function () {
  var order = {
    items: [{ id: 2, name: 'Tea', hsn: '0902', price: 1000, qty: 1 }],
    coupon: 'WELCOME'
  };

  var ledgerFigures = pricing.computeTotals(order.items, order.coupon);
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(ledgerFigures.discount, 50);
  assert.equal(ledgerFigures.tax, 171);
  assert.equal(ledgerFigures.total, 1121);
  assert.equal(invoiceFigures.discount, 50);
  assert.equal(invoiceFigures.tax, 171);
  assert.equal(invoiceFigures.total, 1121);
});

test('invoice render shows CGST and SGST as separate totals', function () {
  var html = invoice.render({
    id: 7,
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: '',
    total: 105
  });

  assert.match(html, /<td>CGST<\/td><td class="r">₹2\.50<\/td>/);
  assert.match(html, /<td>SGST<\/td><td class="r">₹2\.50<\/td>/);
  assert.doesNotMatch(html, /CGST \+ SGST \(Total GST\)/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
