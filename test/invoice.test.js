var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

function order(items, coupon) {
  return { id: 9001, date: '2022-01-05', items: items, coupon: coupon || '' };
}

test('invoice uses the product HSN GST rate', function () {
  var figures = invoice.computeInvoiceFigures(order([
    { name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ]));

  assert.deepEqual({ subtotal: figures.subtotal, tax: figures.tax, total: figures.total }, {
    subtotal: 100, tax: 5, total: 105
  });
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('invoice applies the capped SAVE10 discount before calculating GST', function () {
  var figures = invoice.computeInvoiceFigures(order([
    { name: 'Groundnut oil', sku: 'OIL-2', hsn: '1508', price: 2240, qty: 1 }
  ], 'SAVE10'));

  assert.deepEqual({ subtotal: figures.subtotal, discount: figures.discount, taxable: figures.taxable, tax: figures.tax, total: figures.total }, {
    subtotal: 2240, discount: 150, taxable: 2090, tax: 104.5, total: 2194.5
  });
  assert.equal(figures.rows[0].lineDiscount, 150);
  assert.equal(figures.rows[0].lineTax, 104.5);
});

test('an 18% item without a coupon keeps its checkout total', function () {
  var figures = invoice.computeInvoiceFigures(order([
    { name: 'Tea', sku: 'TEA-1', hsn: '0902', price: 100, qty: 1 }
  ]));

  assert.deepEqual({ subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total }, {
    subtotal: 100, discount: 0, tax: 18, total: 118
  });
});
