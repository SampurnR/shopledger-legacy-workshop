'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

// These tests exercise pure calculation functions with in-memory order items.
// They deliberately do not import the store or read data/db.json.
function makeItem(overrides) {
  return Object.assign({
    id: 1,
    sku: 'TEA-1',
    name: 'Packaged tea',
    hsn: '0902',
    price: 1000,
    qty: 1
  }, overrides || {});
}

function calculate(item, coupon) {
  var order = { items: [item], coupon: coupon || '' };
  return {
    billed: pricing.computeTotals(order.items, order.coupon),
    invoiced: invoice.computeInvoiceFigures(order)
  };
}

test('invoice uses the same HSN GST and coupon totals as the customer billing calculation', function () {
  var result = calculate(makeItem({ hsn: '1006', name: 'Rice' }), 'SAVE10');

  assert.equal(result.invoiced.subtotal, result.billed.subtotal);
  assert.equal(result.invoiced.discount, result.billed.discount);
  assert.equal(result.invoiced.tax, result.billed.tax);
  assert.equal(result.invoiced.cgst, result.billed.cgst);
  assert.equal(result.invoiced.sgst, result.billed.sgst);
  assert.equal(result.invoiced.total, result.billed.total);
  assert.equal(result.invoiced.rows[0].gstPercent, 5);
  assert.equal(result.invoiced.rows[0].lineTax, result.billed.lines[0].tax);
});

test('invoice uses the configured HSN GST slab when gstRate is absent', function () {
  var result = calculate(makeItem({ hsn: '1006', name: 'Rice' }));

  assert.equal(result.billed.tax, 50);
  assert.equal(result.billed.total, 1050);
  assert.equal(result.invoiced.tax, 50);
  assert.equal(result.invoiced.total, 1050);
  assert.equal(result.invoiced.rows[0].gstPercent, 5);
  assert.equal(result.invoiced.rows[0].lineTax, 50);
});

test('SAVE10 invoice matches the billed discount, GST, and total', function () {
  var result = calculate(makeItem(), 'SAVE10');

  assert.equal(result.billed.discount, 100);
  assert.equal(result.billed.tax, 162);
  assert.equal(result.billed.total, 1062);
  assert.equal(result.invoiced.discount, 100);
  assert.equal(result.invoiced.tax, 162);
  assert.equal(result.invoiced.total, 1062);
  assert.deepEqual([result.invoiced.cgst, result.invoiced.sgst], [81, 81]);
});

test('FLAT50 invoice matches the billed GST and total', function () {
  var result = calculate(makeItem(), 'FLAT50');

  assert.equal(result.billed.discount, 50);
  assert.equal(result.billed.tax, 171);
  assert.equal(result.billed.total, 1121);
  assert.equal(result.invoiced.discount, 50);
  assert.equal(result.invoiced.tax, 171);
  assert.equal(result.invoiced.total, 1121);
});

test('WHOLESALE15 invoice matches the capped billed discount, GST, and total', function () {
  var result = calculate(makeItem({ price: 3000 }), 'WHOLESALE15');

  assert.equal(result.billed.discount, 400);
  assert.equal(result.billed.tax, 468);
  assert.equal(result.billed.total, 3068);
  assert.equal(result.invoiced.discount, 400);
  assert.equal(result.invoiced.tax, 468);
  assert.equal(result.invoiced.total, 3068);
});

test('invoice interprets decimal gstRate the same way as customer billing', function () {
  var result = calculate(makeItem({ gstRate: 0.05 }));

  // Both paths treat 0.05 as a 5% rate.
  assert.equal(result.billed.tax, 50);
  assert.equal(result.billed.total, 1050);
  assert.equal(result.invoiced.rows[0].gstPercent, 5);
  assert.equal(result.invoiced.tax, 50);
  assert.equal(result.invoiced.total, 1050);
});

test('invoice GST totals sum the same rounded line GST as customer billing', function () {
  var order = {
    items: [makeItem({ price: 0.03, qty: 1 }), makeItem({ id: 2, price: 0.03, qty: 1 })],
    coupon: ''
  };
  var billed = pricing.computeTotals(order.items, order.coupon);
  var invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(billed.tax, 0.02);
  assert.deepEqual(invoiced.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.equal(invoiced.tax, 0.02);
  assert.equal(invoiced.total, 0.08);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.total, billed.total);
});

test('invoice total matches customer billing after component rounding', function () {
  var result = calculate(makeItem({ price: 0.05, gstRate: 18 }));

  assert.equal(result.invoiced.subtotal, 0.05);
  assert.equal(result.invoiced.tax, 0.01);
  assert.equal(result.invoiced.total, 0.06);
});
