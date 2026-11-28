'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice matches the billed order total and HSN GST breakdown', function () {
  var order = {
    id: 1009,
    items: [{ id: 1, name: 'Indrayani Rice', hsn: '1006', price: 640, qty: 1 }],
    coupon: '',
    subtotal: 640,
    discount: 0,
    tax: 32,
    total: 672
  };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 640,
    discount: 0,
    tax: 32,
    cgst: 16,
    sgst: 16,
    total: 672,
    rows: [{
      name: 'Indrayani Rice',
      sku: '-',
      hsn: '1006',
      qty: 1,
      price: 640,
      gstPercent: 5,
      line: 640,
      lineTax: 32
    }]
  });
});

test('CURRENT BEHAVIOUR: checkout resolves GST from HSN and applies coupon to subtotal', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 5 }
  ];

  assert.deepEqual(pricing.computeTotals(items, 'SAVE10'), {
    subtotal: 500,
    discount: 50,
    taxable: 450,
    tax: 22.5,
    cgst: 11.25,
    sgst: 11.25,
    total: 472.5,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 500,
      discount: 50,
      taxable: 450,
      tax: 22.5,
      net: 472.5
    }]
  });
});

test('invoice follows HSN-based checkout tax and preserves the recorded coupon amounts', function () {
  var order = {
    id: 1001,
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 5 }],
    coupon: 'SAVE10',
    subtotal: 500,
    discount: 50,
    tax: 22.5,
    total: 472.5
  };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 500,
    discount: 50,
    tax: 22.5,
    cgst: 11.25,
    sgst: 11.25,
    total: 472.5,
    rows: [{
      name: 'Rice',
      sku: '-',
      hsn: '1006',
      qty: 5,
      price: 100,
      gstPercent: 5,
      line: 500,
      lineTax: 22.5
    }]
  });
});

test('invoice uses recorded order totals when they are present', function () {
  var order = {
    id: 1002,
    items: [{ name: 'Tea', hsn: '0902', gstRate: 18, price: 50, qty: 1 }],
    coupon: '',
    subtotal: 999,
    discount: 30,
    tax: 99,
    total: 1068
  };

  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.subtotal, 999);
  assert.equal(figures.discount, 30);
  assert.equal(figures.tax, 99);
  assert.equal(figures.cgst, 49.5);
  assert.equal(figures.sgst, 49.5);
  assert.equal(figures.total, 1068);
});

test('invoice preserves the recorded zero discount and does not reapply a coupon', function () {
  var order = {
    id: 1003,
    date: '2026-11-28',
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: 'DIWALI20',
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  };

  var figures = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);

  assert.equal(figures.discount, 0);
  assert.equal(figures.total, 105);
  assert.doesNotMatch(html, /Coupon Discount/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
