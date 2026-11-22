'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var coupons = require('../lib/coupons');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

function item(overrides) {
  return Object.assign({
    id: 1,
    sku: 'TEST-001',
    name: 'Test rice',
    hsn: '1006',
    price: 100,
    qty: 1
  }, overrides || {});
}

function assertInvoiceMatchesBilled(items, coupon) {
  var billed = pricing.computeTotals(items, coupon);
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: coupon });

  assert.equal(invoiceFigures.subtotal, billed.subtotal);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
  assert.deepEqual(invoiceFigures.rows.map(function (row) {
    return { gstPercent: row.gstPercent, line: row.line, lineTax: row.lineTax };
  }), billed.lines.map(function (line) {
    return { gstPercent: line.gstPercent, line: line.gross, lineTax: line.tax };
  }));
}

test('invoice uses HSN GST and totals from the billed pricing calculation', function () {
  assertInvoiceMatchesBilled([item()], '');
});

test('invoice applies percent coupons to the same amount as billing', function () {
  assertInvoiceMatchesBilled([item({ price: 1000 })], 'WELCOME');
});

test('invoice applies coupon discount caps the same as billing', function () {
  assertInvoiceMatchesBilled([item({ price: 3000 })], 'SAVE10');
});

test('invoice does not apply a coupon below its minimum order value', function () {
  var items = [item({ price: 200 })];
  assert.equal(coupons.validate('SAVE10', pricing.subtotal(items)).valid, false);
  assertInvoiceMatchesBilled(items, 'SAVE10');
});
