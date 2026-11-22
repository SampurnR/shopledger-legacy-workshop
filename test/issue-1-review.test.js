'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const config = require('../config');

test('invoice exposes independently calculated taxable amounts for the issue fixtures', () => {
  for (const [price, qty, expected] of [
    // 1020 - 102 = 918; 918 * 5% = 45.90.
    [1020, 1, [1020, 102, 918, 45.9, 22.95, 22.95, 963.9]],
    // 2240 - capped 150 = 2090; 2090 * 5% = 104.50.
    [1120, 2, [2240, 150, 2090, 104.5, 52.25, 52.25, 2194.5]]
  ]) {
    const actual = invoice.computeInvoiceFigures({ items: [{ price, qty, hsn: '1508' }], coupon: 'SAVE10' });
    assert.deepEqual(['subtotal', 'discount', 'taxable', 'tax', 'cgst', 'sgst', 'total'].map(key => actual[key]), expected);
  }
});

test('invoice preserves fractional-paise rounding and odd-paise CGST/SGST splits', () => {
  for (const [price, expected] of [
    // 1.005 rounds to 1.01; GST 0.0505 rounds to 0.05, split 0.03/0.02.
    [1.005, [1.01, 0, 1.01, 0.05, 0.03, 0.02, 1.06]],
    // GST on 0.10 is 0.005, rounded to 0.01 and split 0.01/0.00.
    [0.1, [0.1, 0, 0.1, 0.01, 0.01, 0, 0.11]]
  ]) {
    const actual = invoice.computeInvoiceFigures({ items: [{ price, qty: 1, hsn: '1006' }] });
    assert.deepEqual(['subtotal', 'discount', 'taxable', 'tax', 'cgst', 'sgst', 'total'].map(key => actual[key]), expected);
    assert.equal(actual.rows[0].line, expected[0]);
    assert.equal(actual.rows[0].lineTax, expected[3]);
  }
});

test('invoice HTML renders correct discounted amounts, escaping and optional-field fallbacks', () => {
  const html = invoice.render({ id: 42, date: '01/01/2022', coupon: 'SAVE10', total: 945,
    items: [{ name: 'Rice <safe> & test', price: 1000, qty: 1, hsn: '1006' }] });
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /INV-42/);
  assert.match(html, /Rice &lt;safe&gt; &amp; test/);
  assert.match(html, /Walk-in Customer/);
  assert.match(html, /SKU: -/);
  assert.match(html, /5%/);
  for (const amount of ['1000.00', '100.00', '45.00', '945.00']) assert.ok(html.includes(amount));
  assert.doesNotMatch(html, /NaN|undefined|Accountant Reconciliation Notice:/);
  // Check nesting of the generated template without a browser or added dependency.
  const stack = [];
  for (const [, closing, tag] of html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*>/gi)) {
    if (['meta', 'br'].includes(tag)) continue;
    if (closing) assert.equal(stack.pop(), tag);
    else stack.push(tag);
  }
  assert.deepEqual(stack, []);
  assert.doesNotThrow(() => invoice.render({ id: 43 }));
});

test('calculating and rendering an invoice leave input and configuration unchanged', () => {
  const order = { id: 44, total: 963.9, coupon: 'SAVE10',
    items: [{ name: 'Rice', price: 1020, qty: 1, hsn: '1006' }] };
  const original = structuredClone(order);
  const originalConfig = structuredClone(config);
  Object.freeze(order.items[0]);
  Object.freeze(order.items);
  Object.freeze(order);
  invoice.computeInvoiceFigures(order);
  invoice.render(order);
  assert.deepEqual(order, original);
  assert.deepEqual(config, originalConfig);
});
