'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const { examples, item, order } = require('../fixtures/invoice-orders');

test('UPDATED: all eight ticket examples agree with the ledger', () => {
  const mismatches = examples.filter(o => {
    const result = invoice.computeInvoiceFigures(o);
    return result.total !== o.total || result.tax !== o.tax;
  });
  assert.deepEqual(mismatches.map(o => o.id), []);
});

test('UPDATED: 1002 uses HSN and taxes after the eligible discount', () => {
  const result = invoice.computeInvoiceFigures(examples[1]);
  assert.equal(result.subtotal, 1020);
  assert.equal(result.discount, 102);
  assert.equal(result.tax, 45.9);
  assert.equal(result.total, 963.9);
  assert.deepEqual(result.rows.map(r => r.gstPercent), [5, 5]);
});

test('UPDATED: 1004 respects the SAVE10 discount cap', () => {
  const result = invoice.computeInvoiceFigures(examples[3]);
  assert.equal(result.discount, 150);
  assert.equal(result.tax, 104.5);
  assert.equal(result.total, 2194.5);
});

test('UPDATED: non-coupon HSN items use their configured slabs', () => {
  assert.equal(invoice.computeInvoiceFigures(examples[0]).tax, 66.9);
  assert.equal(invoice.computeInvoiceFigures(examples[6]).tax, 127);
});

test('18 percent, no-coupon control remains correct', () => {
  const result = invoice.computeInvoiceFigures(examples[7]);
  assert.equal(result.total, 590);
  assert.equal(result.tax, 90);
  assert.equal(result.discount, 0);
});

test('missing items produce an empty zero invoice', () => {
  assert.deepEqual(invoice.computeInvoiceFigures({}), {
    subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: []
  });
});

test('invoice row contract preserves metadata, quantity, price and gross', () => {
  const row = invoice.computeInvoiceFigures(examples[7]).rows[0];
  assert.deepEqual(row, { name: 'Tea', sku: 'TEST-8', hsn: '0902', qty: 1,
    price: 140, gstPercent: 18, line: 140, lineTax: 25.2 });
});

test('missing SKU and HSN render as a dash; unknown HSN uses the fallback rate', () => {
  const result = invoice.computeInvoiceFigures({ items: [{ name: 'Other', price: 100, qty: 1 }] });
  assert.equal(result.rows[0].sku, '-');
  assert.equal(result.rows[0].hsn, '-');
  assert.equal(result.total, 118);
});

test('explicit percentage rate is honored', () => {
  const line = { ...item(1, 'Explicit', '1006', 100, 1), gstRate: 12 };
  assert.equal(invoice.computeInvoiceFigures({ items: [line] }).tax, 12);
});

test('CGST plus SGST preserves an odd-paise GST total', () => {
  const result = invoice.computeInvoiceFigures({ items: [item(1, 'Tiny', '0902', 0.06, 1)] });
  assert.equal(result.tax, 0.01);
  assert.equal(result.cgst, 0.01);
  assert.equal(result.sgst, 0);
});

test('calculation and rendering do not mutate input', () => {
  const input = structuredClone(examples[7]);
  const before = structuredClone(input);
  input.items.forEach(Object.freeze);
  Object.freeze(input.items);
  Object.freeze(input);
  invoice.computeInvoiceFigures(input);
  invoice.render(input);
  assert.deepEqual(input, before);
});

test('invoice escapes customer and line text in HTML', () => {
  const input = order(1, [item(1, '<script>alert(1)</script>', '0902', 100, 1)], '', 100, 0, 18, 118);
  input.customer = '<img src=x onerror=alert(1)> & Co';
  const html = invoice.render(input);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; Co'));
  assert.ok(!html.includes('<script>'));
});

test('rendered control invoice includes printable totals and no mismatch notice', () => {
  const html = invoice.render(examples[7]);
  assert.ok(html.includes('INV-1008'));
  assert.ok(html.includes('₹590.00'));
  assert.ok(html.includes('window.print()'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
});

test('mismatch notice remains available for inconsistent recorded totals', () => {
  const input = { ...examples[7], total: 1 };
  assert.ok(invoice.render(input).includes('Accountant Reconciliation Notice:'));
});
