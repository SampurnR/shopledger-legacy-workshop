'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function makeOrder(items, coupon = '') {
  return {
    id: 1,
    items: items,
    coupon: coupon
  };
}

test('invoice matches checkout totals for Order 1002 (SAVE10 with 5% HSN items)', function () {
  const items = [
    { id: 1, name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
    { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
  ];
  const invoiceFigures = invoice.computeInvoiceFigures(makeOrder(items, 'SAVE10'));

  assert.equal(invoiceFigures.subtotal, 1020);
  assert.equal(invoiceFigures.discount, 102);
  assert.equal(invoiceFigures.tax, 45.9);
  assert.equal(invoiceFigures.total, 963.9);
});

test('invoice uses the HSN 1006 5% slab in line with checkout', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const invoiceFigures = invoice.computeInvoiceFigures(makeOrder(items));
  const checkoutFigures = pricing.computeTotals(items, '');

  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.total, 105);
  assert.equal(invoiceFigures.tax, checkoutFigures.tax);
});

test('invoice uses the HSN 0904 12% slab and taxes the post-discount amount', function () {
  const items = [{ id: 2, name: 'Chilli Powder', hsn: '0904', price: 500, qty: 1 }];
  const invoiceFigures = invoice.computeInvoiceFigures(makeOrder(items, 'WELCOME'));
  const checkoutFigures = pricing.computeTotals(items, 'WELCOME');

  assert.equal(invoiceFigures.rows[0].gstPercent, 12);
  assert.equal(invoiceFigures.discount, 25);
  assert.equal(invoiceFigures.tax, 57);
  assert.equal(invoiceFigures.total, 532);
  assert.equal(invoiceFigures.tax, checkoutFigures.tax);
});

test('invoice applies SAVE10 subtotal discount and the configured ₹150 cap', function () {
  const items = [{ id: 3, name: 'Tea', hsn: '0902', price: 2240, qty: 1 }];
  const invoiceFigures = invoice.computeInvoiceFigures(makeOrder(items, 'SAVE10'));
  const checkoutFigures = pricing.computeTotals(items, 'SAVE10');

  assert.equal(invoiceFigures.tax, 376.2);
  assert.equal(invoiceFigures.discount, 150);
  assert.equal(invoiceFigures.total, 2466.2);
  assert.equal(invoiceFigures.discount, checkoutFigures.discount);
  assert.equal(invoiceFigures.tax, checkoutFigures.tax);
  assert.equal(invoiceFigures.total, checkoutFigures.total);
});

test('invoice matches checkout for no-coupon HSN 0902 items at 18%', function () {
  const items = [{ id: 4, name: 'Tea', hsn: '0902', price: 500, qty: 1 }];
  const invoiceFigures = invoice.computeInvoiceFigures(makeOrder(items));
  const checkoutFigures = pricing.computeTotals(items, '');

  assert.equal(invoiceFigures.rows[0].gstPercent, 18);
  assert.equal(invoiceFigures.tax, checkoutFigures.tax);
  assert.equal(invoiceFigures.total, checkoutFigures.total);
});
