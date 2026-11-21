'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

test('CURRENT BEHAVIOUR: invoice applies SAVE10 to the tax-inclusive amount without the checkout cap', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Groundnut Oil', sku: 'OIL-1', hsn: '1508', price: 1120, qty: 2 }],
    coupon: 'SAVE10'
  });
  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total },
    { subtotal: 2240, discount: 264.32, tax: 403.2, total: 2378.88 }
  );
});

test('CURRENT BEHAVIOUR: invoice defaults a missing gstRate to 18% instead of the item HSN slab', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 }]
  });
  assert.deepEqual(
    { gstPercent: figures.rows[0].gstPercent, tax: figures.tax },
    { gstPercent: 18, tax: 115.2 }
  );
});

test('CURRENT BEHAVIOUR: invoice ignores persisted checkout totals', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 }],
    subtotal: 640, discount: 0, tax: 32, total: 672
  });
  assert.equal(figures.total, 755.2);
});
