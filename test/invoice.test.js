'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

// Hand-written fixtures only. Do not load the store or the application's database.
function item(overrides = {}) {
  return { id: 1, name: 'Fixture rice', sku: 'TEST-001', hsn: '1006', price: 100, qty: 1, ...overrides };
}
function order(overrides = {}) {
  return { id: 9001, date: '15/11/2026', customer: 'Fixture customer', paymentMode: 'cash',
    status: 'completed', coupon: '', items: [item()], subtotal: 100, discount: 0,
    tax: 5, total: 105, ...overrides };
}
function amounts(result) {
  return { subtotal: result.subtotal, discount: result.discount, tax: result.tax,
    cgst: result.cgst, sgst: result.sgst, total: result.total };
}

for (const [hsn, checkoutTax] of [['1006', 5], ['0405', 12]]) {
  test(`invoice uses HSN ${hsn} at checkout's ${checkoutTax}% rate`, () => {
    const result = invoice.computeInvoiceFigures(order({ items: [item({ hsn })] }));
    assert.deepEqual(amounts(result), { subtotal: 100, discount: 0, tax: checkoutTax,
      cgst: checkoutTax / 2, sgst: checkoutTax / 2, total: 100 + checkoutTax });
    assert.equal(result.rows[0].gstPercent, checkoutTax);
    assert.equal(result.rows[0].lineTax, checkoutTax);
  });
}

test('18% HSN items without a coupon agree with the stored bill', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ hsn: '0902' })], tax: 18, total: 118 }));
  assert.deepEqual(amounts(result), { subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118 });
});

test('invoice accepts an explicit percentage GST rate and preserves line details', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ price: 125, qty: 2, gstRate: 12 })] }));
  assert.deepEqual(amounts(result), { subtotal: 250, discount: 0, tax: 30, cgst: 15, sgst: 15, total: 280 });
  assert.deepEqual(result.rows, [{ name: 'Fixture rice', sku: 'TEST-001', hsn: '1006', qty: 2,
    price: 125, gstPercent: 12, line: 250, lineTax: 30 }]);
});

test('invoice accepts decimal GST rate 0.05 as five percent', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ gstRate: 0.05 })] }));
  assert.equal(result.tax, 5);
  assert.equal(result.total, 105);
  assert.equal(result.rows[0].gstPercent, 5);
});

test('invoice preserves an explicit zero GST rate', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ gstRate: 0 })] }));
  assert.equal(result.tax, 0);
  assert.equal(result.rows[0].gstPercent, 0);
});

test('SAVE10 on a 1020 subtotal gives invoice 963.90 matching the bill', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ price: 510, qty: 2 })],
    coupon: 'SAVE10', subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 }));
  assert.deepEqual(amounts(result), { subtotal: 1020, discount: 102, tax: 45.9,
    cgst: 22.95, sgst: 22.95, total: 963.9 });
});

test('SAVE10 respects the 150 cap on a 2240 subtotal', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ price: 1120, qty: 2, hsn: '1508' })],
    coupon: 'SAVE10', subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 }));
  assert.deepEqual(amounts(result), { subtotal: 2240, discount: 150, tax: 104.5,
    cgst: 52.25, sgst: 52.25, total: 2194.5 });
});

test('percentage coupon reduces the taxable amount before GST', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ price: 1000, gstRate: 5 })], coupon: 'SAVE10' }));
  assert.deepEqual(amounts(result), { subtotal: 1000, discount: 100, tax: 45, cgst: 22.5, sgst: 22.5, total: 945 });
});

test('FLAT50 below its minimum gives no discount and a nonnegative invoice', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ price: 10 })], coupon: 'FLAT50' }));
  assert.deepEqual(amounts(result), { subtotal: 10, discount: 0, tax: 0.5, cgst: 0.25, sgst: 0.25, total: 10.5 });
});

test('inactive DIWALI20 is not applied by the invoice', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ price: 1000 })], coupon: 'DIWALI20' }));
  assert.equal(result.discount, 0);
  assert.equal(result.tax, 50);
  assert.equal(result.total, 1050);
});

test('invoice coupon lookup normalizes case and whitespace', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ price: 1000 })], coupon: ' save10 ' }));
  assert.equal(result.discount, 100);
  assert.equal(result.total, 945);
});

test('invoice recomputes from items instead of trusting inconsistent persisted figures', () => {
  const result = invoice.computeInvoiceFigures(order({ subtotal: 999, discount: 99, tax: 1, total: 901 }));
  assert.deepEqual(amounts(result), { subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105 });
});

test('invoice sums rounded row taxes consistently with checkout', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ price: 0.03, hsn: '0902' }), item({ id: 2, price: 0.03, hsn: '0902' })] }));
  assert.deepEqual(result.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.equal(result.tax, 0.02);
  assert.equal(result.cgst, 0.01);
  assert.equal(result.sgst, 0.01);
  assert.equal(result.total, 0.08);
});

test('empty invoice without a coupon returns zero totals and no rows', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [] }));
  assert.deepEqual(amounts(result), { subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0 });
  assert.deepEqual(result.rows, []);
});

test('printed SAVE10 invoice shows billed total and GST without a mismatch notice', () => {
  const html = invoice.render(order({ items: [item({ price: 510, qty: 2 })], coupon: 'SAVE10',
    subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 }));
  assert.match(html, /Invoice Total<\/td><td class="r">\u20b9963\.90/);
  assert.match(html, /Total GST\)<\/td><td class="r">\u20b945\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
});

test('matching invoice has no warning and escapes customer and item text', () => {
  const html = invoice.render(order({ customer: '<Buyer & Co>', items: [item({ hsn: '0902', name: '<Tea & Co>' })], tax: 18, total: 118 }));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
  assert.match(html, /&lt;Buyer &amp; Co&gt;/);
  assert.match(html, /&lt;Tea &amp; Co&gt;/);
});

test('invoice calculation and rendering leave the supplied order unchanged', () => {
  const fixture = order();
  const before = structuredClone(fixture);
  invoice.computeInvoiceFigures(fixture);
  invoice.render(fixture);
  assert.deepEqual(fixture, before);
});

test('invoice still warns when the stored bill differs from calculated figures', () => {
  const html = invoice.render(order({ total: 100 }));
  assert.match(html, /Accountant Reconciliation Notice:/);
  assert.match(html, /by \+\u20b95\.00/);
});
