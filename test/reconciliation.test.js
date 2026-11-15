'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const reports = require('../lib/reports');

// Independent, hand-written bills. No store, server, filesystem or live API calls.
function bill(overrides = {}) {
  return { id: 9001, date: '15/11/2026', customer: 'Fixture customer', status: 'completed',
    coupon: '', subtotal: 100, discount: 0, tax: 18, total: 118,
    items: [{ id: 1, name: 'Fixture tea', hsn: '0902', price: 100, qty: 1 }], ...overrides };
}

test('reconciliation reports an 18% no-coupon bill as matched', () => {
  const result = reports.getGstReconciliation({ orders: [bill()] });
  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].matched, true);
});

test('CURRENT BEHAVIOUR: reconciliation exposes SAVE10 invoice and ledger differences', () => {
  const result = reports.getGstReconciliation({ orders: [bill({ coupon: 'SAVE10',
    subtotal: 1020, discount: 102, tax: 45.9, total: 963.9,
    items: [{ id: 1, name: 'Fixture rice', hsn: '1006', price: 510, qty: 2 }] })] });
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalDelta, 119.34);
  assert.deepEqual(result.rows[0], { orderId: 9001, date: '15/11/2026', customer: 'Fixture customer',
    coupon: 'SAVE10', ledgerSubtotal: 1020, ledgerDiscount: 102, ledgerTax: 45.9, ledgerTotal: 963.9,
    invoiceDiscount: 120.36, invoiceTax: 183.6, invoiceTotal: 1083.24, delta: 119.34, matched: false });
});

test('reconciliation detects a tax-only mismatch even when totals agree', () => {
  const result = reports.getGstReconciliation({ orders: [bill({ tax: 17, total: 118 })] });
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, false);
  assert.equal(result.totalDelta, 0);
});

test('reconciliation excludes cancelled orders and leaves the in-memory database unchanged', () => {
  const db = { orders: [bill(), bill({ id: 9002, status: 'cancelled', tax: 1, total: 1 })] };
  const before = structuredClone(db);
  assert.equal(reports.getGstReconciliation(db).totalChecked, 1);
  assert.deepEqual(db, before);
  assert.deepEqual(reports.getGstReconciliation({ orders: [] }), { totalChecked: 0, mismatchCount: 0, totalDelta: 0, rows: [] });
});
