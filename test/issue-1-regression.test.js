'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

// Representative fixtures, not copies of persisted orders. All amounts below
// are independently calculated; checkout is checked against those constants too.
function line(hsn, price, qty = 1, extra = {}) {
  return { id: hsn, name: 'Isolated regression item', hsn, price, qty, ...extra };
}
function figures(value) {
  return Object.fromEntries(['subtotal', 'discount', 'tax', 'cgst', 'sgst', 'total']
    .map(key => [key, value[key]]));
}
const cases = [
  { name: 'HSN-only 5% without coupon', items: [line('1006', 100)],
    expected: [100, 0, 5, 2.5, 2.5, 105] },
  { name: 'HSN-only 12% without coupon', items: [line('0405', 100)],
    expected: [100, 0, 12, 6, 6, 112] },
  // Explicit rate isolates discount ordering from the missing-HSN bug:
  // 1000 - 100 = 900 taxable; 900 * 5% = 45.
  { name: 'percentage discount precedes GST even with explicit rate',
    items: [line('1006', 1000, 1, { gstRate: 5 })], coupon: 'SAVE10',
    expected: [1000, 100, 45, 22.5, 22.5, 945] },
  // Issue #1002: 1020 - 102 = 918; 918 * 5% = 45.90.
  { name: 'representative Order #1002', id: 1002,
    items: [line('1006', 1020)], coupon: 'SAVE10',
    expected: [1020, 102, 45.9, 22.95, 22.95, 963.9] },
  // Issue #1004: 2240 - capped 150 = 2090; 2090 * 5% = 104.50.
  { name: 'representative Order #1004 with capped SAVE10', id: 1004,
    items: [line('1508', 1120, 2)], coupon: 'SAVE10',
    expected: [2240, 150, 104.5, 52.25, 52.25, 2194.5] },
  // Below FLAT50's 300 minimum: no discount; 100 * 5% = 5.
  { name: 'below-minimum flat coupon is not applied by invoice',
    items: [line('1006', 100, 1, { gstRate: 5 })], coupon: 'FLAT50',
    expected: [100, 0, 5, 2.5, 2.5, 105] },
  // Eligible FLAT50: 400 - 50 = 350; 350 * 5% = 17.50.
  { name: 'eligible flat coupon reduces taxable value',
    items: [line('1006', 400, 1, { gstRate: 5 })], coupon: 'FLAT50',
    expected: [400, 50, 17.5, 8.75, 8.75, 367.5] },
  // Equal 200 lines each receive 20 discount: taxes 9 + 21.60 + 32.40 = 63.
  { name: 'mixed 5%, 12%, 18% lines receive proportional percentage discount',
    items: [line('1006', 200), line('0405', 200), line('0902', 200)], coupon: 'SAVE10',
    expected: [600, 60, 63, 31.5, 31.5, 603], lineTaxes: [9, 21.6, 32.4] }
];

for (const fixture of cases) {
  test('correct invoice: ' + fixture.name, () => {
    const expected = Object.fromEntries(['subtotal', 'discount', 'tax', 'cgst', 'sgst', 'total']
      .map((key, index) => [key, fixture.expected[index]]));
    const checkout = pricing.computeTotals(fixture.items, fixture.coupon || '');
    assert.deepEqual(figures(checkout), expected, 'independent fixture arithmetic agrees with checkout');
    const actual = invoice.computeInvoiceFigures(fixture);
    assert.deepEqual(figures(actual), expected, 'invoice must match independently verified financial figures');
    assert.deepEqual(figures(actual), figures(checkout));
    if (fixture.lineTaxes) {
      assert.deepEqual(actual.rows.map(row => row.lineTax), fixture.lineTaxes);
      assert.deepEqual(actual.rows.map(row => row.gstPercent), [5, 12, 18]);
    }
  });
}

test('reconciliation matches both representative orders on total AND GST', () => {
  const orders = cases.filter(fixture => fixture.id).map(fixture => ({
    ...fixture, ...pricing.computeTotals(fixture.items, fixture.coupon)
  }));
  const result = reports.getGstReconciliation({ orders });
  assert.deepEqual({
    checked: result.totalChecked, mismatches: result.mismatchCount,
    delta: result.totalDelta, matched: result.rows.map(row => row.matched)
  }, { checked: 2, mismatches: 0, delta: 0, matched: [true, true] });
});
