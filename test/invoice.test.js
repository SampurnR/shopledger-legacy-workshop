'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

test('invoice uses the checkout subtotal, capped discount, tax, and total for Order #1004', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Groundnut Oil', sku: 'OIL-1', hsn: '1508', price: 1120, qty: 2 }],
    coupon: 'SAVE10', subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5
  });

  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total },
    { subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 }
  );
});

test('invoice resolves HSN rates and applies the checkout discount to Order #1002', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [
      { name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 },
      { name: 'Sunflower Oil', sku: 'OIL-2', hsn: '1512', price: 190, qty: 2 }
    ],
    coupon: 'SAVE10', subtotal: 1020, discount: 102, tax: 45.9, total: 963.9
  });

  assert.deepEqual(
    { rates: figures.rows.map(function (r) { return r.gstPercent; }), tax: figures.tax, discount: figures.discount, total: figures.total },
    { rates: [5, 5], tax: 45.9, discount: 102, total: 963.9 }
  );
});

test('invoice uses persisted checkout figures for a non-coupon order with a 5% HSN item', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 }],
    subtotal: 640, discount: 0, tax: 32, total: 672
  });

  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total },
    { subtotal: 640, discount: 0, tax: 32, total: 672 }
  );
});
