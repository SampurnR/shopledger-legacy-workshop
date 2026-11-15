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
  test(`CURRENT BEHAVIOUR: invoice uses 18% for HSN ${hsn} instead of checkout's ${checkoutTax}%`, () => {
    const result = invoice.computeInvoiceFigures(order({ items: [item({ hsn })] }));
    assert.deepEqual(amounts(result), { subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118 });
    assert.equal(result.rows[0].gstPercent, 18);
    assert.equal(result.rows[0].lineTax, 18);
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

test('CURRENT BEHAVIOUR: decimal GST rate 0.05 is divided by 100 again', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ gstRate: 0.05 })] }));
  assert.equal(result.tax, 0.05);
  assert.equal(result.total, 100.05);
  assert.equal(result.rows[0].gstPercent, 0);
});

test('CURRENT BEHAVIOUR: explicit zero GST falls back to 18%', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ gstRate: 0 })] }));
  assert.equal(result.tax, 18);
  assert.equal(result.rows[0].gstPercent, 18);
});

test('CURRENT BEHAVIOUR: SAVE10 on a 1020 subtotal gives invoice 1083.24 instead of billed 963.90', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ price: 510, qty: 2 })],
    coupon: 'SAVE10', subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 }));
  assert.deepEqual(amounts(result), { subtotal: 1020, discount: 120.36, tax: 183.6,
    cgst: 91.8, sgst: 91.8, total: 1083.24 });
});

test('CURRENT BEHAVIOUR: SAVE10 ignores the 150 cap on a 2240 subtotal', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ price: 1120, qty: 2, hsn: '1508' })],
    coupon: 'SAVE10', subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 }));
  assert.deepEqual(amounts(result), { subtotal: 2240, discount: 264.32, tax: 403.2,
    cgst: 201.6, sgst: 201.6, total: 2378.88 });
});

test('CURRENT BEHAVIOUR: percentage coupon is applied after tax without reducing taxable GST', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ price: 1000, gstRate: 5 })], coupon: 'SAVE10' }));
  assert.deepEqual(amounts(result), { subtotal: 1000, discount: 105, tax: 50, cgst: 25, sgst: 25, total: 945 });
});

test('CURRENT BEHAVIOUR: FLAT50 below its minimum can make an invoice total negative', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ price: 10 })], coupon: 'FLAT50' }));
  assert.deepEqual(amounts(result), { subtotal: 10, discount: 50, tax: 1.8, cgst: 0.9, sgst: 0.9, total: -38.2 });
});

test('CURRENT BEHAVIOUR: inactive DIWALI20 is still applied by the invoice', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ price: 1000 })], coupon: 'DIWALI20' }));
  assert.equal(result.discount, 236);
  assert.equal(result.tax, 180);
  assert.equal(result.total, 944);
});

test('CURRENT BEHAVIOUR: invoice coupon lookup does not normalize case or whitespace', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ price: 1000 })], coupon: ' save10 ' }));
  assert.equal(result.discount, 0);
  assert.equal(result.total, 1180);
});

test('CURRENT BEHAVIOUR: invoice ignores persisted monetary totals and recomputes from items', () => {
  const result = invoice.computeInvoiceFigures(order({ subtotal: 999, discount: 99, tax: 1, total: 901 }));
  assert.deepEqual(amounts(result), { subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118 });
});

test('CURRENT BEHAVIOUR: invoice rounds aggregate tax rather than summing rounded row taxes', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [item({ price: 0.03 }), item({ id: 2, price: 0.03 })] }));
  assert.deepEqual(result.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.equal(result.tax, 0.01);
  assert.equal(result.cgst, 0.01);
  assert.equal(result.sgst, 0);
  assert.equal(result.total, 0.07);
});

test('empty invoice without a coupon returns zero totals and no rows', () => {
  const result = invoice.computeInvoiceFigures(order({ items: [] }));
  assert.deepEqual(amounts(result), { subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0 });
  assert.deepEqual(result.rows, []);
});

test('CURRENT BEHAVIOUR: printed invoice exposes the wrong figures and a reconciliation notice', () => {
  const html = invoice.render(order({ items: [item({ price: 510, qty: 2 })], coupon: 'SAVE10',
    subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 }));
  assert.match(html, /Invoice Total<\/td><td class="r">\u20b91083\.24/);
  assert.match(html, /Total GST\)<\/td><td class="r">\u20b9183\.60/);
  assert.match(html, /Accountant Reconciliation Notice:/);
  assert.match(html, /recorded total \(\u20b9963\.90\)/);
  assert.match(html, /by \+\u20b9119\.34/);
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
