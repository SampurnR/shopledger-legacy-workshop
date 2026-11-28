'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function makeOrder(items, coupon) {
  const totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 42,
    date: '15/01/2026',
    customer: 'In-memory test customer',
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

function riceOrder(price, qty, coupon) {
  return makeOrder([{
    id: 1,
    sku: 'RICE-001',
    name: 'Rice',
    hsn: '1006',
    price,
    qty
  }], coupon);
}

test('invoice matches the billed HSN GST rate and total', () => {
  const order = riceOrder(100, 2, '');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 10);
  assert.equal(order.total, 210);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.cgst, 5);
  assert.equal(figures.sgst, 5);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
});

test('invoice matches billed coupon cap, GST, and total', () => {
  const order = riceOrder(1000, 2, 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 150);
  assert.equal(order.tax, 92.5);
  assert.equal(order.total, 1942.5);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, order.tax);
  assert.equal(figures.cgst, 46.25);
  assert.equal(figures.sgst, 46.25);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
});

test('GST reconciliation reports a match when invoice and billed order figures agree', () => {
  const order = riceOrder(1000, 2, 'SAVE10');
  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].invoiceDiscount, order.discount);
  assert.equal(result.rows[0].invoiceTax, order.tax);
  assert.equal(result.rows[0].invoiceTotal, order.total);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});
