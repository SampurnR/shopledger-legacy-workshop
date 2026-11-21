'use strict';

require('./helpers/guard-store');
const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');
const orders = require('./fixtures/orders.json');

// Baseline assertions written and run before any production change (c9b2b3b).
// Intentionally updated after the fix: #1001-#1007 and mismatch count.
// The original CURRENT BEHAVIOUR expectations remain in that commit.
// Tuple order: subtotal, discount, GST, invoice total.
const baseline = [
  [610, 0, 66.9, 676.9],
  [1020, 102, 45.9, 963.9],
  [400, 50, 49.35, 399.35],
  [2240, 150, 104.5, 2194.5],
  [1000, 50, 91.96, 1041.96],
  [1210, 60.5, 155.61, 1305.11],
  [1280, 0, 127, 1407],
  [500, 0, 90, 590]
];

for (const [index, order] of orders.entries()) {
  test(`invoice #${order.id} figures${index < 7 ? ' (updated after ticket #1 fix)' : ''}`, () => {
    const figures = invoice.computeInvoiceFigures(structuredClone(order));
    assert.deepEqual(
      [figures.subtotal, figures.discount, figures.tax, figures.total],
      baseline[index]
    );
  });
}

test('reconciliation matches all eight fixture orders (updated after ticket #1 fix)', () => {
  const result = reports.getGstReconciliation({ orders: structuredClone(orders) });
  assert.equal(result.totalChecked, 8);
  assert.equal(result.mismatchCount, 0);
});

test('invoice calculation preserves the input order', () => {
  const order = structuredClone(orders[1]);
  const before = structuredClone(order);
  for (const item of order.items) Object.freeze(item);
  Object.freeze(order.items);
  Object.freeze(order);
  invoice.computeInvoiceFigures(order);
  invoice.render(order);
  assert.deepEqual(order, before);
});

test('invoice exposes the established fields consumed by reports and rendering', () => {
  const result = invoice.computeInvoiceFigures(orders[7]);
  for (const key of ['subtotal', 'discount', 'tax', 'cgst', 'sgst', 'total', 'rows']) {
    assert.ok(Object.hasOwn(result, key), key);
  }
  assert.deepEqual(result.rows[0], {
    name: orders[7].items[0].name, sku: 'BEV-001', hsn: '0902', qty: 1,
    price: 140, gstPercent: 18, line: 140, discount: 0, taxable: 140, lineTax: 25.2
  });
});

test('empty order yields finite zero figures and an empty printable table', () => {
  const result = invoice.computeInvoiceFigures({});
  assert.equal(result.subtotal, 0);
  assert.equal(result.tax, 0);
  assert.equal(result.discount, 0);
  assert.equal(result.total, 0);
  assert.deepEqual(result.rows, []);
  assert.match(invoice.render({ id: 1, total: 0 }), /Invoice Total/);
});

test('renderer escapes item/customer metadata and preserves invoice identity', () => {
  const order = structuredClone(orders[7]);
  order.customer = '<script>alert(1)</script>';
  order.items[0].name = 'Tea & <strong>coffee</strong>';
  const html = invoice.render(order);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('Tea &amp; &lt;strong&gt;coffee&lt;/strong&gt;'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('INV-1008'));
});

test('renderer warns on a real ledger discrepancy rather than hiding it', () => {
  const order = structuredClone(orders[7]);
  order.total = 580;
  assert.match(invoice.render(order), /Accountant Reconciliation Notice/);
  assert.match(invoice.render(order), /\+₹10\.00/);
});

test('unknown HSN retains the configured fallback tax rate', () => {
  const result = invoice.computeInvoiceFigures({ items: [{ name: 'Unknown', price: 100, qty: 1, hsn: '9999' }] });
  assert.equal(result.tax, 18);
  assert.equal(result.total, 118);
});

test('reconciliation excludes cancelled orders', () => {
  const order = { ...structuredClone(orders[1]), status: 'cancelled' };
  const result = reports.getGstReconciliation({ orders: [order] });
  assert.equal(result.totalChecked, 0);
  assert.equal(result.mismatchCount, 0);
});
