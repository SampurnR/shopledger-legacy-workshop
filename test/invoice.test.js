'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

function anilOrder() {
  return {
    id: 1002,
    coupon: 'SAVE10',
    total: 963.90,
    items: [
      { name: 'Indrayani Basmati Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 },
      { name: 'Sunflower Oil', sku: 'OIL-001', hsn: '1512', price: 190, qty: 2 }
    ]
  };
}

test('CURRENT BEHAVIOUR: invoice recalculates order 1002 using the fallback GST and discounts tax', function () {
  var figures = invoice.computeInvoiceFigures(anilOrder());
  assert.equal(figures.subtotal, 1020);
  assert.equal(figures.tax, 183.6);
  assert.equal(figures.discount, 120.36);
  assert.equal(figures.total, 1083.24);
});

test('CURRENT BEHAVIOUR: invoice does not enforce the SAVE10 maximum discount', function () {
  var figures = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [{ name: 'Groundnut Oil', hsn: '1508', price: 1120, qty: 2 }]
  });
  assert.equal(figures.discount, 264.32);
  assert.equal(figures.total, 2378.88);
});

test('CURRENT BEHAVIOUR: an HSN 1006 item uses the default 18 percent slab', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  });
  assert.equal(figures.rows[0].gstPercent, 18);
  assert.equal(figures.tax, 18);
});

test('CURRENT BEHAVIOUR: invoice markup omits line discount and taxable values', function () {
  var html = invoice.render(anilOrder());
  assert.match(html, /<th class="r">GST Amt<\/th>/);
  assert.doesNotMatch(html, /<th class="r">Discount<\/th>/);
  assert.doesNotMatch(html, /Taxable Subtotal/);
});
