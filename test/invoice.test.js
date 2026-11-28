var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');

test('invoice figures match the amount billed at checkout', function () {
  var figures = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [
      { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { id: 4, sku: 'OIL-001', name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
    ]
  });

  assert.equal(figures.subtotal, 1020);
  assert.equal(figures.discount, 102);
  assert.equal(figures.tax, 45.9);
  assert.equal(figures.cgst, 22.95);
  assert.equal(figures.sgst, 22.95);
  assert.equal(figures.total, 963.9);
  assert.deepEqual(figures.rows, [
    { name: 'Rice', sku: 'GRN-001', hsn: '1006', qty: 1, price: 640, gstPercent: 5, line: 640, lineTax: 28.8 },
    { name: 'Sunflower oil', sku: 'OIL-001', hsn: '1512', qty: 2, price: 190, gstPercent: 5, line: 380, lineTax: 17.1 }
  ]);
});

test('invoice enforces the coupon maximum discount', function () {
  var figures = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [
      { id: 5, sku: 'OIL-002', name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 }
    ]
  });

  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 104.5);
  assert.equal(figures.total, 2194.5);
});
