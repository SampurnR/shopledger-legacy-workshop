'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

test('invoice uses each product HSN GST slab in the breakdown and total', function () {
  const order = {
    items: [
      { name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 100, qty: 1 },
      { name: 'Ghee', sku: 'DRY-001', hsn: '0405', price: 200, qty: 1 }
    ],
    coupon: ''
  };

  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, 300);
  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [5, 12]);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [5, 24]);
  assert.equal(figures.tax, 29);
  assert.equal(figures.cgst, 14.5);
  assert.equal(figures.sgst, 14.5);
  assert.equal(figures.total, 329);
});

test('invoice applies the coupon to the subtotal before calculating HSN GST', function () {
  const order = {
    items: [
      { name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 400, qty: 1 }
    ],
    coupon: 'WELCOME'
  };

  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, 400);
  assert.equal(figures.tax, 19);
  assert.equal(figures.cgst, 9.5);
  assert.equal(figures.sgst, 9.5);
  assert.equal(figures.discount, 20);
  assert.equal(figures.total, 399);
});
