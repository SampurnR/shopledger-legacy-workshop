'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('CURRENT BEHAVIOUR: checkout uses HSN slab and discounts taxable subtotal before GST', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];

  assert.deepEqual(pricing.computeTotals(items, 'WELCOME'), {
    subtotal: 100,
    discount: 5,
    taxable: 95,
    tax: 4.75,
    cgst: 2.38,
    sgst: 2.37,
    total: 99.75,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 100,
      discount: 5,
      taxable: 95,
      tax: 4.75,
      net: 99.75
    }]
  });
});

test('invoice uses checkout HSN slab and taxable coupon discount', function () {
  var order = {
    id: 7,
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: 'WELCOME',
    total: 99.75
  };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 100,
    discount: 5,
    tax: 4.75,
    cgst: 2.38,
    sgst: 2.37,
    total: 99.75,
    rows: [{
      name: 'Rice',
      sku: '-',
      hsn: '1006',
      qty: 1,
      price: 100,
      gstPercent: 5,
      line: 100,
      lineTax: 4.75
    }]
  });
});

test('invoice figures match checkout and the billed order total', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var order = { id: 7, items: items, coupon: 'WELCOME', total: 99.75 };
  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.tax, 4.75);
  assert.equal(figures.discount, 5);
  assert.equal(figures.total, 99.75);
});

test('invoice HTML matches stored order total without a reconciliation warning', function () {
  var html = invoice.render({
    id: 7,
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: 'WELCOME',
    total: 99.75
  });

  assert.match(html, /Invoice Total<\/td><td class="r">₹99\.75/);
  assert.doesNotMatch(html, /Reconciliation Notice/);
});
