'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice matches the GST slab, tax, and total recorded when billing', function () {
  var items = [{ id: 1, name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(invoiceFigures.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(invoiceFigures.rows[0].lineTax, billed.lines[0].tax);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice uses the HSN GST slab used for billing', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var order = { items: items, coupon: '' };
  var billed = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.cgst, 2.5);
  assert.equal(invoiceFigures.sgst, 2.5);
  assert.equal(invoiceFigures.total, 105);
});

test('invoice applies the billed coupon discount before calculating line GST', function () {
  var items = [{ id: 1, name: 'Packaged goods', price: 500, qty: 1 }];
  var order = { items: items, coupon: 'SAVE10' };
  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 50);
  assert.equal(billed.tax, 81);
  assert.equal(billed.total, 531);
  assert.equal(invoiceFigures.discount, 50);
  assert.equal(invoiceFigures.tax, 81);
  assert.equal(invoiceFigures.rows[0].lineTax, 81);
  assert.equal(invoiceFigures.total, 531);
});
