'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');
const { orders } = require('./fixtures.json');

const expected = [
  { id: 1001, rates: [18, 5], lineTax: [50.40, 16.50], split: [33.45, 33.45] },
  { id: 1002, rates: [5, 5], lineTax: [28.80, 17.10], split: [22.95, 22.95] },
  { id: 1004, rates: [5], lineTax: [104.50], split: [52.25, 52.25] },
  { id: 1007, rates: [12, 5], lineTax: [108, 19], split: [63.50, 63.50] },
  { id: 1008, rates: [18, 18], lineTax: [25.20, 64.80], split: [45, 45] }
];

for (const { id, rates, lineTax, split } of expected) {
  test('invoice ' + id + ' agrees with the saved checkout and shows the correct line GST', () => {
    const order = orders[id];
    const figures = invoice.computeInvoiceFigures(order);
    for (const field of ['subtotal', 'discount', 'tax', 'total']) {
      assert.equal(figures[field], order[field], field);
    }
    assert.deepEqual(figures.rows.map(row => row.gstPercent), rates);
    assert.deepEqual(figures.rows.map(row => row.lineTax), lineTax);
    assert.deepEqual([figures.cgst, figures.sgst], split);
  });
}

test('printable invoice 1004 shows the capped discount and recorded total without a warning', () => {
  const html = invoice.render(orders[1004]);
  assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td[^>]*>-[^\d]*150\.00/);
  assert.match(html, /Invoice Total<\/td><td[^>]*>[^\d]*2194\.50/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('historical pricing drift preserves saved amounts and withholds unverified line GST', () => {
  const order = { ...orders[1002], tax: 42, total: 960 };
  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td[^>]*>[^\d]*960\.00/);
  assert.match(html, /\(Total GST\)<\/td><td[^>]*>[^\d]*42\.00/);
  assert.match(html, /Line GST could not be verified/);
  assert.doesNotMatch(html, /<td class="r">\d+%<\/td>/);

  const report = reports.getGstReconciliation({ orders: [order] });
  assert.equal(report.mismatchCount, 1);
  assert.equal(report.rows[0].delta, 3.90);
});

test('a historical discount mismatch flags reconciliation even if tax and total agree', () => {
  const order = { ...orders[1008], discount: 1 };
  const html = invoice.render(order);
  assert.match(html, /Line GST could not be verified/);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 1);
});
