'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');
const { examples, item } = require('../fixtures/invoice-orders');

for (const example of examples) {
  test('REGRESSION: invoice matches independently specified ledger figures for #' + example.id, () => {
    const result = invoice.computeInvoiceFigures(example);
    for (const field of ['subtotal', 'discount', 'tax', 'total']) {
      assert.equal(result[field], example[field], field + ' for #' + example.id);
    }
    assert.equal(pricing.round2(result.cgst + result.sgst), result.tax);
    assert.equal(pricing.round2(result.rows.reduce((sum, r) => sum + r.lineTax, 0)), result.tax);
    assert.ok(!invoice.render(example).includes('Accountant Reconciliation Notice:'));
  });
}

test('REGRESSION: reports reconcile all eight in-memory examples with zero variance', () => {
  const result = reports.getGstReconciliation({ orders: examples });
  assert.equal(result.totalChecked, 8);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.ok(result.rows.every(row => row.matched));
});

test('REGRESSION: mixed-slab FLAT50 taxes discounted lines independently', () => {
  const result = invoice.computeInvoiceFigures(examples[2]);
  assert.deepEqual(result.rows.map(r => [r.gstPercent, r.lineTax]), [[12, 27.3], [18, 22.05]]);
  assert.equal(result.cgst, 24.68);
  assert.equal(result.sgst, 24.67);
  assert.deepEqual(result.rows.map(r => r.line), [260, 140]); // Preserve Line Gross display.
});

for (const [label, coupon, price, expectedDiscount] of [
  ['normalized code', ' save10 ', 1000, 100],
  ['minimum not reached', 'SAVE10', 499, 0],
  ['minimum reached', 'SAVE10', 500, 50],
  ['expired code', 'DIWALI20', 2000, 0],
  ['unknown code', 'MISSING', 1000, 0],
  ['flat minimum not reached', 'FLAT50', 299, 0],
  ['welcome cap', 'WELCOME', 3000, 100],
  ['wholesale cap', 'WHOLESALE15', 4000, 400]
]) {
  test('REGRESSION: shared coupon rules - ' + label, () => {
    const result = invoice.computeInvoiceFigures({ items: [item(1, 'Rice', '1006', price, 1)], coupon });
    assert.equal(result.discount, expectedDiscount);
    assert.equal(result.tax, pricing.round2((price - expectedDiscount) * 0.05));
    assert.equal(result.total, pricing.round2(price - expectedDiscount + result.tax));
  });
}

for (const [gstRate, expected] of [[0, 0], [0.12, 12], [12, 12]]) {
  test('REGRESSION: explicit rate ' + gstRate + ' follows checkout precedence over HSN', () => {
    const result = invoice.computeInvoiceFigures({ items: [{ ...item(1, 'Override', '0902', 100, 1), gstRate }] });
    assert.equal(result.tax, expected);
    assert.equal(result.rows[0].gstPercent, expected);
  });
}

test('REGRESSION: per-line rounding follows checkout for fractional amounts', () => {
  const input = { items: [item(1, 'A', '1006', 0.1, 3), item(2, 'B', '0405', 0.29, 3)], coupon: 'WELCOME' };
  const result = invoice.computeInvoiceFigures(input);
  assert.equal(result.subtotal, 1.17);
  assert.equal(result.discount, 0.06);
  assert.equal(result.tax, 0.11);
  assert.equal(result.total, 1.22);
  assert.deepEqual(result.rows.map(r => r.lineTax), [0.01, 0.1]);
});

test('REGRESSION: a changed stored tax is still flagged by reconciliation', () => {
  const changed = { ...examples[7], tax: 89.99 };
  const result = reports.getGstReconciliation({ orders: [changed] });
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.rows[0].matched, false);
});
