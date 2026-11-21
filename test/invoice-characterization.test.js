'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

function orderWith(item, coupon) {
  return {
    id: 42,
    date: '2026-11-21',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: [item],
    coupon: coupon || ''
  };
}

test('invoice uses the HSN GST slab when order lines contain HSN but no gstRate', function () {
  const item = { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 1 };
  const checkout = pricing.computeTotals([item], '');
  const invoiceFigures = invoice.computeInvoiceFigures(orderWith(item));

  assert.equal(checkout.tax, 5);
  assert.equal(checkout.cgst, 2.5);
  assert.equal(checkout.sgst, 2.5);
  assert.equal(checkout.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.cgst, 2.5);
  assert.equal(invoiceFigures.sgst, 2.5);
  assert.equal(invoiceFigures.total, 105);
});

test('invoice applies flat coupon before GST, matching checkout', function () {
  const item = { id: 2, sku: 'TEA-1', name: 'Tea', hsn: '0902', price: 500, qty: 1 };
  const checkout = pricing.computeTotals([item], 'FLAT50');
  const invoiceFigures = invoice.computeInvoiceFigures(orderWith(item, 'FLAT50'));

  assert.equal(checkout.discount, 50);
  assert.equal(checkout.tax, 81);
  assert.equal(checkout.total, 531);
  assert.equal(invoiceFigures.discount, 50);
  assert.equal(invoiceFigures.tax, 81);
  assert.equal(invoiceFigures.total, 531);
});

test('invoice percent coupon honors maxDiscount and applies it before GST', function () {
  const item = { id: 3, sku: 'TEA-2', name: 'Tea case', hsn: '0902', price: 5000, qty: 1 };
  const checkout = pricing.computeTotals([item], 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures(orderWith(item, 'SAVE10'));

  assert.equal(checkout.discount, 150);
  assert.equal(checkout.tax, 873);
  assert.equal(checkout.total, 5723);
  assert.equal(invoiceFigures.discount, 150);
  assert.equal(invoiceFigures.tax, 873);
  assert.equal(invoiceFigures.total, 5723);
});
