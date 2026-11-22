'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function inMemoryOrder(items, coupon) {
  const totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 1,
    date: '01/01/2022',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice uses the billed HSN slab when a line has no gstRate', function () {
  const order = inMemoryOrder([
    { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 1000, qty: 1 }
  ]);

  const billed = pricing.computeTotals(order.items, order.coupon);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.tax, 50);
  assert.equal(billed.total, 1050);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 50);
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.cgst, billed.cgst);
  assert.equal(figures.sgst, billed.sgst);
  assert.equal(figures.total, billed.total);
});

test('invoice follows billed discount allocation, tax, and coupon cap', function () {
  const order = inMemoryOrder([
    { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 3000, qty: 1 }
  ], 'SAVE10');

  const billed = pricing.computeTotals(order.items, order.coupon);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 142.5);
  assert.equal(billed.total, 2992.5);
  assert.equal(figures.rows[0].lineTax, billed.lines[0].tax);
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.cgst, billed.cgst);
  assert.equal(figures.sgst, billed.sgst);
  assert.equal(figures.discount, billed.discount);
  assert.equal(figures.total, billed.total);
});

test('invoice matches billed result when a coupon fails its minimum order', function () {
  const order = inMemoryOrder([
    { id: 2, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 100, qty: 1 }
  ], 'FLAT50');

  const billedCoupon = require('../lib/coupons').validate(order.coupon, order.subtotal);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(billedCoupon.valid, false);
  assert.equal(order.discount, 0);
  assert.equal(figures.discount, 0);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
});
