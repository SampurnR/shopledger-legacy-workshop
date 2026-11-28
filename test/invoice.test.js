var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

function order(overrides) {
  return Object.assign({
    id: 1002,
    customer: 'Test Customer',
    date: '05/01/2022',
    status: 'completed',
    paymentMode: 'upi',
    coupon: 'SAVE10',
    items: [
      { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { id: 4, sku: 'OIL-001', name: 'Sunflower Oil', hsn: '1512', price: 190, qty: 2 }
    ],
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    total: 963.9
  }, overrides || {});
}

test('invoice applies HSN GST slabs', function () {
  var figures = invoice.computeInvoiceFigures(order({ coupon: '' }));
  assert.equal(figures.tax, 51);
});

test('SAVE10 is calculated on the pre-tax subtotal', function () {
  var figures = invoice.computeInvoiceFigures(order());
  assert.equal(figures.discount, 102);
  assert.equal(figures.tax, 45.9);
  assert.equal(figures.total, 963.9);
});

test('invoice respects the SAVE10 maximum discount cap', function () {
  var figures = invoice.computeInvoiceFigures(order({
    id: 1004,
    items: [
      { id: 5, sku: 'OIL-002', name: 'Groundnut Oil', hsn: '1508', price: 1120, qty: 2 }
    ],
    subtotal: 2240,
    discount: 150,
    tax: 104.5,
    total: 2194.5
  }));
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 104.5);
  assert.equal(figures.total, 2194.5);
});
