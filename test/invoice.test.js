'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function billedOrder(id, items, coupon) {
  const totals = pricing.computeTotals(items, coupon || '');
  return {
    id,
    date: '15/03/2022',
    customer: 'In-memory fixture',
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

const order1001 = billedOrder(1001, [
  { id: 8, sku: 'BEV-001', name: 'Tea', hsn: '0902', price: 140, qty: 2 },
  { id: 2, sku: 'GRN-002', name: 'Dal', hsn: '0713', price: 165, qty: 2 }
]);

const order1002 = billedOrder(1002, [
  { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 640, qty: 1 },
  { id: 4, sku: 'OIL-001', name: 'Oil', hsn: '1512', price: 190, qty: 2 }
], 'SAVE10');

const order1004 = billedOrder(1004, [
  { id: 9, sku: 'FIX-001', name: 'Packaged item', hsn: '0902', price: 2240, qty: 1 }
], 'SAVE10');

const order1007 = billedOrder(1007, [
  { id: 10, sku: 'FIX-002', name: 'Ghee', hsn: '0405', price: 500, qty: 1 }
]);

const order1008 = billedOrder(1008, [
  { id: 11, sku: 'FIX-003', name: 'Coffee', hsn: '0901', price: 500, qty: 1 }
]);

function assertInvoiceMatchesCheckout(order) {
  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.subtotal, order.subtotal);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
}

test('order #1002 invoice matches SAVE10 checkout totals and HSN tax lines', () => {
  const figures = invoice.computeInvoiceFigures(order1002);

  assert.equal(order1002.subtotal, 1020);
  assert.equal(order1002.discount, 102);
  assert.equal(order1002.tax, 45.9);
  assert.equal(order1002.total, 963.9);
  assert.equal(figures.discount, 102);
  assert.equal(figures.tax, 45.9);
  assert.equal(figures.total, 963.9);
  assert.deepEqual(figures.rows.map(row => row.gstPercent), [5, 5]);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [28.8, 17.1]);
});

test('order #1004 invoice applies the SAVE10 discount cap', () => {
  const figures = invoice.computeInvoiceFigures(order1004);

  assert.equal(order1004.discount, 150);
  assert.equal(figures.discount, 150);
  assertInvoiceMatchesCheckout(order1004);
});

test('invoice uses configured HSN rates for 5% and 12% items', () => {
  const fivePercentItem = invoice.computeInvoiceFigures({ items: [
    { name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ] });
  const twelvePercentItem = invoice.computeInvoiceFigures({ items: [
    { name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
  ] });

  assert.equal(fivePercentItem.rows[0].gstPercent, 5);
  assert.equal(twelvePercentItem.rows[0].gstPercent, 12);
  assert.equal(fivePercentItem.tax, 5);
  assert.equal(twelvePercentItem.tax, 12);
});

test('orders #1001 and #1007 invoice GST matches checkout HSN calculations', () => {
  assert.equal(order1001.tax, 66.9);
  assertInvoiceMatchesCheckout(order1001);
  assert.equal(order1007.tax, 60);
  assertInvoiceMatchesCheckout(order1007);
});

test('all-18% order #1008 without a coupon continues to match checkout', () => {
  assert.equal(order1008.tax, 90);
  assert.equal(order1008.total, 590);
  assertInvoiceMatchesCheckout(order1008);
});

test('GST reconciliation marks matching in-memory invoices as balanced', () => {
  const result = reports.getGstReconciliation({
    orders: [order1001, order1002, order1004, order1007, order1008]
  });

  assert.equal(result.totalChecked, 5);
  assert.equal(result.mismatchCount, 0);
  assert.deepEqual(result.rows.map(row => [row.orderId, row.matched]), [
    [1001, true],
    [1002, true],
    [1004, true],
    [1007, true],
    [1008, true]
  ]);
});
