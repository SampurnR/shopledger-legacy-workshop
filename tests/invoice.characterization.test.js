'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');
const tax = require('../lib/tax');

function makeOrder(items, coupon) {
  const totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 9001,
    date: '15/11/2026',
    customer: 'Characterization Customer',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice total and GST breakdown match checkout for an HSN-priced coupon order', function () {
  const order = makeOrder([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 }
  ], 'WELCOME');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 30.4);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
});

test('CURRENT BEHAVIOUR — checkout applies HSN GST after the coupon discount', function () {
  const totals = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ], 'WELCOME');

  assert.equal(totals.subtotal, 100);
  assert.equal(totals.discount, 5);
  assert.equal(totals.taxable, 95);
  assert.equal(totals.tax, 4.75);
  assert.equal(totals.cgst, 2.38);
  assert.equal(totals.sgst, 2.37);
  assert.equal(totals.total, 99.75);
  assert.equal(totals.lines[0].gstPercent, 5);
});

test('invoice uses the checkout HSN GST rate when an order line has no gstRate', function () {
  const order = makeOrder([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 5);
  assert.equal(order.total, 105);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
});

test('invoice applies a percentage coupon to subtotal before GST like checkout', function () {
  const order = makeOrder([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ], 'WELCOME');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 5);
  assert.equal(order.tax, 4.75);
  assert.equal(order.total, 99.75);
  assert.equal(figures.discount, 5);
  assert.equal(figures.tax, 4.75);
  assert.equal(figures.total, 99.75);
});

test('invoice interprets decimal gstRate the same way as checkout', function () {
  const item = {
    id: 2,
    name: 'Rice with explicit rate',
    sku: 'RICE-2',
    hsn: '1006',
    gstRate: 0.05,
    price: 100,
    qty: 1
  };
  const order = makeOrder([item]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(tax.getRateForItem(item), 0.05);
  assert.equal(order.tax, 5);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
});

test('GST reconciliation matches invoice totals with checkout', function () {
  const order = makeOrder([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ], 'WELCOME');
  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].ledgerTax, 4.75);
  assert.equal(result.rows[0].invoiceTax, 4.75);
  assert.equal(result.rows[0].ledgerTotal, 99.75);
  assert.equal(result.rows[0].invoiceTotal, 99.75);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});

test('rendered invoice shows checkout GST and total without a mismatch notice', function () {
  const order = makeOrder([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ], 'WELCOME');
  const html = invoice.render(order);

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /<td class="r">5%<\/td>/);
  assert.match(html, /₹4\.75<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹99\.75/);
});
