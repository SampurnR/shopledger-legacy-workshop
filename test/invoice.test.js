'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice uses the configured HSN GST slab', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var order = { items: items, coupon: '' };

  var billed = pricing.computeTotals(items, '');
  var invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(invoiced.rows[0].gstPercent, 5);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.total, billed.total);
});

test('invoice applies coupon before calculating GST', function () {
  var items = [{ id: 2, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];
  var order = { items: items, coupon: 'WELCOME' };

  var billed = pricing.computeTotals(items, 'WELCOME');
  var invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(invoiced.subtotal, billed.subtotal);
  assert.equal(invoiced.discount, billed.discount);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.total, billed.total);
});

test('invoice interprets a decimal gstRate as a rate', function () {
  var items = [{ id: 3, name: 'Item', price: 100, qty: 1, gstRate: 0.05 }];
  var order = { items: items, coupon: '' };

  var billed = pricing.computeTotals(items, '');
  var invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(invoiced.rows[0].gstPercent, 5);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.total, billed.total);
});
