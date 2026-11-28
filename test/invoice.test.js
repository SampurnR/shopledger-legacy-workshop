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

test('CURRENT BEHAVIOUR: invoice applies default 18% GST instead of HSN slabs', function () {
  var figures = invoice.computeInvoiceFigures(order({ coupon: '' }));
  assert.equal(figures.tax, 183.6);
});

test('CURRENT BEHAVIOUR: SAVE10 is calculated on subtotal plus tax', function () {
  var figures = invoice.computeInvoiceFigures(order());
  assert.equal(figures.discount, 120.36);
  assert.equal(figures.total, 1083.24);
});

test('CURRENT BEHAVIOUR: invoice ignores the SAVE10 maximum discount cap', function () {
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
  assert.equal(figures.discount, 264.32);
  assert.equal(figures.tax, 403.2);
  assert.equal(figures.total, 2378.88);
});
