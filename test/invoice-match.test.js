'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

test('invoice figures match the billed order for rice with SAVE10', () => {
  const order = {
    id: 1009, date: '28/11/2026', customer: 'Walk-in', coupon: 'SAVE10',
    items: [{ id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 640, qty: 1 }],
    subtotal: 640, discount: 64, tax: 28.8, total: 604.8
  };
  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.subtotal, 640);
  assert.equal(figures.discount, 64);
  assert.equal(figures.tax, 28.8);
  assert.equal(figures.cgst, 14.4);
  assert.equal(figures.sgst, 14.4);
  assert.equal(figures.total, 604.8);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 28.8);
});
