'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

function order1002() {
  return {
    id: 1002,
    coupon: 'SAVE10',
    items: [
      { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
      { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
    ]
  };
}

function order1004() {
  return {
    id: 1004,
    coupon: 'SAVE10',
    items: [
      { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
    ]
  };
}

test('Invoice applies the HSN 5% rate and SAVE10 before GST, matching order 1002', function () {
  var figures = invoice.computeInvoiceFigures(order1002());

  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [5, 5]);
  assert.equal(figures.discount, 102);
  assert.equal(figures.tax, 45.9);
  assert.equal(figures.total, 963.9);
});

test('Invoice respects the SAVE10 cap and HSN 5% rate, matching order 1004', function () {
  var figures = invoice.computeInvoiceFigures(order1004());

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 104.5);
  assert.equal(figures.total, 2194.5);
});

test('Invoice applies the HSN 12% rate for an order without a coupon', function () {
  var figures = invoice.computeInvoiceFigures({
    id: 1010,
    coupon: '',
    items: [
      { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', hsn: '0405', price: 450, qty: 2 }
    ]
  });

  assert.equal(figures.rows[0].gstPercent, 12);
  assert.equal(figures.tax, 108);
  assert.equal(figures.total, 1008);
});
