'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var coupons = require('../lib/coupons');

test('checkout pricing applies HSN GST and the configured SAVE10 cap', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 2000, qty: 1 }];
  var totals = pricing.computeTotals(items, 'SAVE10');

  assert.equal(totals.discount, 150);
  assert.equal(totals.tax, 92.5);
  assert.equal(totals.total, 1942.5);
});

test('invoice GST breakdown and total match checkout pricing', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 2000, qty: 1 }];
  var totals = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(invoiceFigures.rows[0].gstPercent, totals.lines[0].gstPercent);
  assert.equal(invoiceFigures.rows[0].lineTax, totals.lines[0].tax);
  assert.equal(invoiceFigures.discount, totals.discount);
  assert.equal(invoiceFigures.tax, totals.tax);
  assert.equal(invoiceFigures.cgst, totals.cgst);
  assert.equal(invoiceFigures.sgst, totals.sgst);
  assert.equal(invoiceFigures.total, totals.total);
});

test('expired coupon is rejected and does not reduce invoice total', function () {
  var items = [{ id: 2, name: 'Dal', sku: 'GRN-002', hsn: '0713', price: 600, qty: 1 }];
  var validation = coupons.validate('DIWALI20', 600);
  var totals = pricing.computeTotals(items, 'DIWALI20');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'DIWALI20' });

  assert.equal(validation.valid, false);
  assert.match(validation.error, /expired/);
  assert.equal(totals.discount, 0);
  assert.equal(invoiceFigures.discount, 0);
  assert.equal(invoiceFigures.total, totals.total);
});

test('invoice honors a decimal GST rate using the checkout interpretation', function () {
  var items = [{ id: 3, name: 'Other item', price: 100, qty: 1, gstRate: 0.05 }];
  var totals = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(totals.tax, 5);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.total, 105);
});
