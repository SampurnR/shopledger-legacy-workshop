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

test('order 1002 invoice figures match checkout GST and coupon discount', function () {
  var figures = invoice.computeInvoiceFigures(anilOrder());
  assert.equal(figures.subtotal, 1020);
  assert.equal(figures.discount, 102);
  assert.equal(figures.taxable, 918);
  assert.equal(figures.tax, 45.9);
  assert.equal(figures.cgst, 22.95);
  assert.equal(figures.sgst, 22.95);
  assert.equal(figures.total, 963.9);
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.gstPercent, row.discount, row.taxable, row.lineTax];
  }), [[5, 64, 576, 28.8], [5, 38, 342, 17.1]]);
});

test('SAVE10 invoice discount observes its configured cap', function () {
  var figures = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [{ name: 'Groundnut Oil', hsn: '1508', price: 1120, qty: 2 }]
  });
  assert.equal(figures.discount, 150);
  assert.equal(figures.taxable, 2090);
  assert.equal(figures.tax, 104.5);
  assert.equal(figures.total, 2194.5);
});

test('invoice resolves a product GST slab from its HSN code', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  });
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
});

test('invoice markup includes the line and summary tax breakdown', function () {
  var html = invoice.render(anilOrder());
  assert.match(html, /<th class="r">GST Amt<\/th>/);
  assert.match(html, /<th class="r">Discount<\/th>/);
  assert.match(html, /<th class="r">Taxable<\/th>/);
  assert.match(html, /Taxable Subtotal/);
  assert.match(html, /<td>CGST<\/td>/);
  assert.match(html, /<td>SGST<\/td>/);
});
