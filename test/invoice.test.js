'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

function item(overrides) {
  return Object.assign({
    id: 1,
    name: 'Rice',
    sku: 'RICE-1',
    hsn: '1006',
    price: 1000,
    qty: 1
  }, overrides || {});
}

function figures(order) {
  var result = invoice.computeInvoiceFigures(order);
  return {
    subtotal: result.subtotal,
    discount: result.discount,
    tax: result.tax,
    cgst: result.cgst,
    sgst: result.sgst,
    total: result.total
  };
}

test('invoice figures match the GST and total calculated when the order is billed', function () {
  var rice = item();
  var billed = pricing.computeTotals([rice], 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({
    items: [rice],
    coupon: 'SAVE10'
  });

  assert.deepEqual(figures({ items: [rice], coupon: 'SAVE10' }), {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total
  });
  assert.equal(invoiceFigures.rows[0].lineTax, billed.lines[0].tax);
});

test('invoice uses the HSN rate and evenly splits GST without a coupon', function () {
  var order = { items: [item()] };
  var result = invoice.computeInvoiceFigures(order);

  assert.equal(result.rows[0].gstPercent, 5);
  assert.equal(result.rows[0].lineTax, 50);
  assert.equal(result.tax, 50);
  assert.equal(result.cgst, 25);
  assert.equal(result.sgst, 25);
  assert.equal(result.total, 1050);
});

test('invoice uses the same capped SAVE10 discount and post-discount GST as pricing', function () {
  var bulkRice = item({ price: 3000 });
  var billed = pricing.computeTotals([bulkRice], 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({
    items: [bulkRice],
    coupon: 'SAVE10'
  });

  assert.equal(billed.discount, 150);
  assert.deepEqual(figures({ items: [bulkRice], coupon: 'SAVE10' }), {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total
  });
  assert.equal(invoiceFigures.rows[0].lineTax, billed.lines[0].tax);
});

test('invoice does not apply an inactive coupon that pricing rejects', function () {
  var rice = item();
  var billed = pricing.computeTotals([rice], 'DIWALI20');
  var invoiceOrder = { items: [rice], coupon: 'DIWALI20' };

  assert.equal(billed.discount, 0);
  assert.deepEqual(figures(invoiceOrder), {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total
  });
});
