'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function billedOrder(id, items, coupon, expected) {
  return {
    id,
    date: '15/03/2022',
    customer: 'In-memory fixture',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon: coupon || '',
    subtotal: expected.subtotal,
    discount: expected.discount,
    tax: expected.tax,
    total: expected.total
  };
}

const expected1001 = {
  subtotal: 610,
  discount: 0,
  taxable: 610,
  tax: 66.9,
  cgst: 33.45,
  sgst: 33.45,
  total: 676.9
};
const order1001 = billedOrder(1001, [
  { id: 8, sku: 'BEV-001', name: 'Tea', hsn: '0902', price: 140, qty: 2 },
  { id: 2, sku: 'GRN-002', name: 'Dal', hsn: '0713', price: 165, qty: 2 }
], '', expected1001);

const expected1002 = {
  subtotal: 1020,
  discount: 102,
  taxable: 918,
  tax: 45.9,
  cgst: 22.95,
  sgst: 22.95,
  total: 963.9
};
const order1002 = billedOrder(1002, [
  { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 640, qty: 1 },
  { id: 4, sku: 'OIL-001', name: 'Oil', hsn: '1512', price: 190, qty: 2 }
], 'SAVE10', expected1002);

const expected1004 = {
  subtotal: 2240,
  discount: 150,
  taxable: 2090,
  tax: 376.2,
  cgst: 188.1,
  sgst: 188.1,
  total: 2466.2
};
const order1004 = billedOrder(1004, [
  { id: 9, sku: 'FIX-001', name: 'Packaged item', hsn: '0902', price: 2240, qty: 1 }
], 'SAVE10', expected1004);

const expected1007 = {
  subtotal: 500,
  discount: 0,
  taxable: 500,
  tax: 60,
  cgst: 30,
  sgst: 30,
  total: 560
};
const order1007 = billedOrder(1007, [
  { id: 10, sku: 'FIX-002', name: 'Ghee', hsn: '0405', price: 500, qty: 1 }
], '', expected1007);

const expected1008 = {
  subtotal: 500,
  discount: 0,
  taxable: 500,
  tax: 90,
  cgst: 45,
  sgst: 45,
  total: 590
};
const order1008 = billedOrder(1008, [
  { id: 11, sku: 'FIX-003', name: 'Coffee', hsn: '0901', price: 500, qty: 1 }
], '', expected1008);

function assertMatchesLiteral(actual, expected, label) {
  const taxable = actual.taxable === undefined
    ? Math.round((actual.total - actual.tax) * 100) / 100
    : actual.taxable;

  assert.equal(actual.subtotal, expected.subtotal, label + ' subtotal');
  assert.equal(actual.discount, expected.discount, label + ' discount');
  assert.equal(taxable, expected.taxable, label + ' taxable');
  assert.equal(actual.tax, expected.tax, label + ' GST');
  assert.equal(actual.cgst, expected.cgst, label + ' CGST');
  assert.equal(actual.sgst, expected.sgst, label + ' SGST');
  assert.equal(actual.total, expected.total, label + ' total');
}

function assertCheckoutAndInvoice(order, expected) {
  const checkout = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assertMatchesLiteral(checkout, expected, 'checkout');
  assertMatchesLiteral(invoiceFigures, expected, 'invoice');
}

test('order #1002 SAVE10 matches literal checkout and invoice totals', () => {
  assertCheckoutAndInvoice(order1002, expected1002);

  const invoiceFigures = invoice.computeInvoiceFigures(order1002);
  assert.deepEqual(invoiceFigures.rows.map(row => row.gstPercent), [5, 5]);
  assert.deepEqual(invoiceFigures.rows.map(row => row.lineTax), [28.8, 17.1]);
});

test('order #1004 SAVE10 respects the literal ₹150 discount cap', () => {
  assert.equal(expected1004.discount, 150);
  assertCheckoutAndInvoice(order1004, expected1004);
});

test('5% and 12% HSN slabs match literal checkout and invoice GST', () => {
  assertCheckoutAndInvoice(order1002, expected1002);
  assertCheckoutAndInvoice(order1007, expected1007);

  const fivePercentInvoice = invoice.computeInvoiceFigures(order1002);
  const twelvePercentInvoice = invoice.computeInvoiceFigures(order1007);
  assert.deepEqual(fivePercentInvoice.rows.map(row => row.gstPercent), [5, 5]);
  assert.deepEqual(twelvePercentInvoice.rows.map(row => row.gstPercent), [12]);
  assert.deepEqual(twelvePercentInvoice.rows.map(row => row.lineTax), [60]);
});

test('no-coupon mixed-HSN order #1001 matches literal checkout and invoice totals', () => {
  assertCheckoutAndInvoice(order1001, expected1001);

  const invoiceFigures = invoice.computeInvoiceFigures(order1001);
  assert.deepEqual(invoiceFigures.rows.map(row => row.gstPercent), [18, 5]);
  assert.deepEqual(invoiceFigures.rows.map(row => row.lineTax), [50.4, 16.5]);
});

test('no-coupon all-18% order #1008 matches literal checkout and invoice totals', () => {
  assertCheckoutAndInvoice(order1008, expected1008);
});

test('GST reconciliation balances the literal in-memory invoice fixtures', () => {
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
