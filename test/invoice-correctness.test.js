'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

function orderWith(items, coupon) {
  return { items: items, coupon: coupon || '' };
}

test('invoice uses HSN slabs and agrees with checkout on mixed-rate discounted orders', function () {
  const items = [
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 },
    { id: 2, name: 'Ghee', sku: 'GHEE-1', hsn: '0405', price: 450, qty: 1 }
  ];
  const checkout = pricing.computeTotals(items, 'SAVE10');
  const figures = invoice.computeInvoiceFigures(orderWith(items, 'SAVE10'));

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[1].gstPercent, 12);
  assert.equal(figures.discount, checkout.discount);
  assert.equal(figures.tax, checkout.tax);
  assert.equal(figures.cgst, checkout.cgst);
  assert.equal(figures.sgst, checkout.sgst);
  assert.equal(figures.total, checkout.total);
});

test('invoice honors coupon maximum discount and calculates tax after discount', function () {
  const items = [{ id: 3, name: 'Tea case', sku: 'TEA-2', hsn: '0902', price: 5000, qty: 1 }];
  const checkout = pricing.computeTotals(items, 'SAVE10');
  const figures = invoice.computeInvoiceFigures(orderWith(items, 'SAVE10'));

  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 873);
  assert.equal(figures.total, 5723);
  assert.equal(figures.tax, checkout.tax);
  assert.equal(figures.total, checkout.total);
});
