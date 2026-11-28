'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('invoice matches order pricing for an uncouponed default-rate item', function () {
  const order = {
    items: [{ id: 1, name: 'Unclassified item', sku: 'SKU-1', price: 100, qty: 2 }],
    coupon: ''
  };

  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(billed.subtotal, 200);
  assert.equal(billed.tax, 36);
  assert.equal(billed.total, 236);
  assert.equal(invoiced.subtotal, 200);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.total, billed.total);
  assert.equal(invoiced.cgst, 18);
  assert.equal(invoiced.sgst, 18);
});

test('invoice uses the order pricing HSN slab when the line has no gstRate', function () {
  const order = {
    items: [{ id: 2, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 100, qty: 1 }],
    coupon: ''
  };

  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(invoiced.rows[0].gstPercent, 5);
  assert.equal(invoiced.rows[0].lineTax, billed.lines[0].tax);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.cgst, billed.cgst);
  assert.equal(invoiced.sgst, billed.sgst);
  assert.equal(invoiced.total, billed.total);
});

test('invoice applies the same capped SAVE10 discount and post-discount GST as order pricing', function () {
  const order = {
    items: [{ id: 3, name: 'Rice bulk pack', sku: 'GRN-BULK', hsn: '1006', gstRate: 5, price: 3000, qty: 1 }],
    coupon: 'SAVE10'
  };

  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(billed.subtotal, 3000);
  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 142.5);
  assert.equal(billed.total, 2992.5);
  assert.equal(invoiced.discount, billed.discount);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.rows[0].lineTax, billed.lines[0].tax);
  assert.equal(invoiced.total, billed.total);
});

test('invoice preserves recorded discount and GST after a coupon becomes inactive', function () {
  const order = {
    items: [{ id: 4, name: 'Staples', sku: 'ST-1', price: 1000, qty: 1 }],
    coupon: 'DIWALI20',
    subtotal: 1000,
    discount: 200,
    tax: 144,
    total: 944
  };

  const invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(invoiced.subtotal, order.subtotal);
  assert.equal(invoiced.discount, order.discount);
  assert.equal(invoiced.rows[0].lineTax, order.tax);
  assert.equal(invoiced.tax, order.tax);
  assert.equal(invoiced.cgst, 72);
  assert.equal(invoiced.sgst, 72);
  assert.equal(invoiced.total, order.total);
});

test('GST reconciliation compares the recorded order against fresh pricing figures', function () {
  const order = {
    id: 1001,
    date: '01/01/2026',
    customer: 'Walk-in',
    items: [{ id: 5, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 100, qty: 1 }],
    coupon: '',
    subtotal: 100,
    discount: 0,
    tax: 18,
    total: 118
  };

  const invoiced = invoice.computeInvoiceFigures(order);
  const reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(invoiced.tax, 18);
  assert.equal(invoiced.total, 118);
  assert.equal(reconciliation.mismatchCount, 1);
  assert.equal(reconciliation.rows[0].invoiceTax, 5);
  assert.equal(reconciliation.rows[0].invoiceTotal, 105);
});
