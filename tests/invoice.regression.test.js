'use strict';

require('./helpers/guard-store');
const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const orders = require('./fixtures/orders.json');

// Expectations are saved customer charges, not values calculated by invoice.js.
for (const order of orders) {
  test(`REGRESSION: invoice #${order.id} matches independently recorded ledger figures`, () => {
    const result = invoice.computeInvoiceFigures(structuredClone(order));
    assert.deepEqual(
      [result.subtotal, result.discount, result.tax, result.total],
      [order.subtotal, order.discount, order.tax, order.total]
    );
  });
}

test('REGRESSION: invoice #1002 shows discounted 5% line taxes of INR 28.80 and 17.10', () => {
  const result = invoice.computeInvoiceFigures(orders[1]);
  assert.deepEqual(result.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 28.8], [5, 17.1]]);
  assert.equal(result.cgst, 22.95);
  assert.equal(result.sgst, 22.95);
});

test('REGRESSION: correctly reconciled invoice #1002 has no false mismatch banner', () => {
  const html = invoice.render(orders[1]);
  assert.ok(!html.includes('Accountant Reconciliation Notice'));
  assert.match(html, /₹963\.90/);
});

test('REGRESSION: printable breakdown exposes discount, taxable value and both GST components', () => {
  const result = invoice.computeInvoiceFigures(orders[1]);
  assert.equal(result.taxable, 918);
  assert.deepEqual(result.rows.map(row => [row.line, row.discount, row.taxable]), [
    [640, 64, 576], [380, 38, 342]
  ]);
  const html = invoice.render(orders[1]);
  for (const label of ['Taxable Value', 'CGST', 'SGST']) assert.ok(html.includes(label));
  assert.ok(html.includes('₹576.00'));
  assert.ok(html.includes('₹342.00'));
});

for (const [code, subtotal, discount, gst, total] of [
  ['DIWALI20', 2000, 0, 100, 2100],
  ['SAVE10', 400, 0, 20, 420],
  ['FLAT50', 250, 0, 12.5, 262.5],
  [' save10 ', 1000, 100, 45, 945],
  ['WELCOME', 4000, 100, 195, 4095],
  ['WHOLESALE15', 4000, 400, 180, 3780]
]) {
  test(`REGRESSION: invoice respects coupon eligibility/caps for ${JSON.stringify(code)} at ${subtotal}`, () => {
    const result = invoice.computeInvoiceFigures({ coupon: code, items: [{ name: 'Rice', hsn: '1006', price: subtotal, qty: 1 }] });
    assert.deepEqual([result.discount, result.tax, result.total], [discount, gst, total]);
  });
}

for (const [rate, expected] of [[0, 0], [0.12, 12], [12, 12]]) {
  test(`REGRESSION: explicit GST rate ${rate} preserves the checkout contract`, () => {
    const result = invoice.computeInvoiceFigures({ items: [{ name: 'Item', price: 100, qty: 1, hsn: '1006', gstRate: rate }] });
    assert.equal(result.tax, expected);
    assert.equal(result.rows[0].gstPercent, expected);
  });
}

test('REGRESSION: invoice rounds each line like checkout for fractional-paise tax', () => {
  const result = invoice.computeInvoiceFigures({ items: [
    { name: 'Rice', price: 0.1, qty: 1, hsn: '1006' },
    { name: 'Dal', price: 0.1, qty: 1, hsn: '0713' }
  ] });
  assert.equal(result.tax, 0.02);
  assert.equal(result.total, 0.22);
});

test('REGRESSION: deterministic cart matrix preserves checkout parity and never mutates inputs', () => {
  // A small cross-product explores slab/coupon/rounding interactions, including
  // unrecognized HSN and empty carts. Golden amounts above prevent a self-oracle.
  let checked = 0;
  for (const hsn of ['1006', '0405', '0902', 'unknown']) {
    for (const price of [0.1, 19.99, 250, 1120]) {
      for (const coupon of ['', 'SAVE10', 'FLAT50', 'WELCOME', 'WHOLESALE15', 'DIWALI20', 'unknown']) {
        for (const qty of [1, 2, 5]) {
          const order = { coupon, items: [
            { id: 1, name: 'Item A', price, qty, hsn },
            { id: 2, name: 'Item B', price: 140, qty: 1, hsn: '0902' }
          ] };
          const before = structuredClone(order);
          const expected = pricing.computeTotals(order.items, coupon);
          const actual = invoice.computeInvoiceFigures(order);
          for (const key of ['subtotal', 'discount', 'tax', 'cgst', 'sgst', 'total']) {
            assert.equal(actual[key], expected[key], `${hsn}/${price}/${coupon}/${qty}: ${key}`);
          }
          assert.deepEqual(order, before);
          checked++;
        }
      }
    }
  }
  assert.equal(checked, 336);
});
