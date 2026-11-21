'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const tax = require('../lib/tax');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');
const { orders, fractionalItems } = require('./fixtures.json');

function amounts({ subtotal, discount, tax, total }) {
  return [subtotal, discount, tax, total];
}

// Fixture amounts verified against saved orders 1001, 1002, 1004, 1007 and 1008.
for (const order of Object.values(orders)) {
  test('checkout reproduces saved amounts for order ' + order.id, () => {
    assert.deepEqual(amounts(pricing.computeTotals(order.items, order.coupon)), amounts(order));
  });
}

test('checkout rounds fractional line amounts and applies 5%, 12%, and 18% after discount', () => {
  const figures = pricing.computeTotals(fractionalItems, 'WELCOME');
  assert.deepEqual(amounts(figures), [398.88, 19.94, 34.10, 413.04]);
  assert.deepEqual(figures.lines.map(line => [line.gstPercent, line.discount, line.tax]),
    [[5, 9.26, 8.80], [12, 9.86, 22.48], [18, 0.82, 2.82]]);
  assert.deepEqual([figures.cgst, figures.sgst], [17.05, 17.05]);
  assert.deepEqual(tax.splitCgstSgst(0.01), { cgst: 0.01, sgst: 0 });
});

test('invoice applies 5% GST after the 1002 coupon', () => {
  const figures = invoice.computeInvoiceFigures(orders[1002]);
  assert.deepEqual(amounts(figures), [1020, 102, 45.90, 963.90]);
  assert.deepEqual(figures.rows.map(row => row.gstPercent), [5, 5]);
});

test('invoice respects the SAVE10 cap on 1004', () => {
  const figures = invoice.computeInvoiceFigures(orders[1004]);
  assert.deepEqual(amounts(figures), [2240, 150, 104.50, 2194.50]);
});

test('fractional invoice follows checkout rounding and taxes the discounted lines', () => {
  const figures = invoice.computeInvoiceFigures({ items: fractionalItems, coupon: 'WELCOME' });
  assert.deepEqual(amounts(figures), [398.88, 19.94, 34.10, 413.04]);
});

test('all-18% non-coupon invoice 1008 agrees with checkout', () => {
  const figures = invoice.computeInvoiceFigures(orders[1008]);
  assert.deepEqual(amounts(figures), [500, 0, 90, 590]);
  assert.deepEqual(figures.rows.map(row => row.gstPercent), [18, 18]);
  assert.deepEqual([figures.cgst, figures.sgst], [45, 45]);
});

test('reconciliation matches the five fixture invoices and skips cancelled orders', () => {
  const reconciliation = reports.getGstReconciliation({
    orders: [...Object.values(orders), { ...orders[1002], id: 9999, status: 'cancelled' }]
  });
  assert.deepEqual([reconciliation.totalChecked, reconciliation.mismatchCount, reconciliation.totalDelta],
    [5, 0, 0]);
  assert.deepEqual(reconciliation.rows.map(row => [row.orderId, row.delta, row.matched]),
    [[1001, 0, true], [1002, 0, true], [1004, 0, true],
      [1007, 0, true], [1008, 0, true]]);
});
