'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

function makeItem(overrides) {
  return Object.assign({
    id: 1,
    name: 'Sample item',
    sku: 'SAMPLE-1',
    hsn: '0902',
    price: 100,
    qty: 1
  }, overrides);
}

function makeOrder(items, coupon) {
  return { items, coupon: coupon || '' };
}

test('checkout and invoice agree for an undiscounted item using the default GST rate', function () {
  const items = [makeItem({ hsn: 'UNMAPPED', price: 100 })];
  const checkout = pricing.computeTotals(items, '');
  const invoiceFigures = invoice.computeInvoiceFigures(makeOrder(items));

  assert.equal(checkout.tax, 18);
  assert.equal(checkout.total, 118);
  assert.equal(invoiceFigures.tax, checkout.tax);
  assert.equal(invoiceFigures.total, checkout.total);
});

test('invoice uses the configured HSN slab instead of the default GST rate', function () {
  const items = [makeItem({ hsn: '1006', price: 100 })];
  const checkout = pricing.computeTotals(items, '');
  const invoiceFigures = invoice.computeInvoiceFigures(makeOrder(items));

  assert.equal(checkout.tax, 5);
  assert.equal(checkout.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.rows[0].lineTax, 5);
  assert.equal(invoiceFigures.tax, checkout.tax);
  assert.equal(invoiceFigures.total, checkout.total);
});

test('invoice matches checkout discount cap and GST for SAVE10', function () {
  const items = [makeItem({ hsn: '0902', price: 3000 })];
  const checkout = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures(makeOrder(items, 'SAVE10'));

  assert.equal(checkout.discount, 150);
  assert.equal(checkout.tax, 513);
  assert.equal(checkout.total, 3363);
  assert.equal(invoiceFigures.discount, checkout.discount);
  assert.equal(invoiceFigures.tax, checkout.tax);
  assert.equal(invoiceFigures.total, checkout.total);
});

test('invoice calculates flat coupon GST on the discounted taxable value', function () {
  const items = [makeItem({ hsn: '0902', price: 500 })];
  const checkout = pricing.computeTotals(items, 'FLAT50');
  const invoiceFigures = invoice.computeInvoiceFigures(makeOrder(items, 'FLAT50'));

  assert.equal(checkout.discount, 50);
  assert.equal(checkout.tax, 81);
  assert.equal(checkout.total, 531);
  assert.equal(invoiceFigures.discount, checkout.discount);
  assert.equal(invoiceFigures.tax, checkout.tax);
  assert.equal(invoiceFigures.total, checkout.total);
});

test('invoice calculates the expected HSN GST rate, split, and total', function () {
  const order = makeOrder([makeItem({ hsn: '1006', price: 100 })]);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.rows[0].lineTax, 5);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.cgst, 2.5);
  assert.equal(invoiceFigures.sgst, 2.5);
  assert.equal(invoiceFigures.total, 105);
});
