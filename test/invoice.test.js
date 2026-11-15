'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeInvoiceFigures, render } = require('../lib/invoice');
const { computeTotals } = require('../lib/pricing');
const { getGstReconciliation } = require('../lib/reports');

function line(name, hsn, price) {
  return { name, hsn, price, qty: 1 };
}

function order(id, items, coupon = '') {
  const { subtotal, discount, tax, total } = computeTotals(items, coupon);
  return { id, items, coupon, subtotal, discount, tax, total };
}

test('SAVE10 invoice calculates GST after the discount', () => {
  const sale = order(1002, [line('Rice', '1006', 1020)], 'SAVE10');
  const invoice = computeInvoiceFigures(sale);

  assert.deepEqual([sale.subtotal, sale.discount, sale.tax, sale.total],
    [1020, 102, 45.90, 963.90]);
  assert.deepEqual([invoice.discount, invoice.tax, invoice.cgst, invoice.sgst, invoice.total],
    [102, 45.90, 22.95, 22.95, 963.90]);

  const html = render(sale);
  assert.match(html, /<td class="r">5%<\/td><td class="r">₹45\.90<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹963\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice respects the SAVE10 cap applied at checkout', () => {
  const sale = order(1004, [line('Groundnut oil', '1508', 2240)], 'SAVE10');
  const invoice = computeInvoiceFigures(sale);

  assert.deepEqual([sale.discount, sale.tax, sale.total], [150, 104.50, 2194.50]);
  assert.deepEqual([invoice.discount, invoice.tax, invoice.total], [150, 104.50, 2194.50]);
});

test('invoice uses 5% and 12% HSN rates without a coupon', () => {
  const sale = order(1001, [line('Rice', '1006', 100), line('Ghee', '0405', 100)]);
  const invoice = computeInvoiceFigures(sale);

  assert.deepEqual([sale.tax, sale.total], [17, 217]);
  assert.deepEqual(invoice.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]),
    [[5, 5], [12, 12]]);
  assert.deepEqual([invoice.discount, invoice.tax, invoice.total], [0, 17, 217]);
});

test('invoice agrees with checkout for an 18% HSN item without a coupon', () => {
  const sale = order(1008, [line('Tea', '0902', 100)]);
  const invoice = computeInvoiceFigures(sale);

  assert.deepEqual([sale.tax, sale.total], [18, 118]);
  assert.deepEqual([invoice.discount, invoice.tax, invoice.total], [0, 18, 118]);
  assert.doesNotMatch(render(sale), /Accountant Reconciliation Notice/);
});

test('GST reconciliation matches checkout figures and skips cancelled orders', () => {
  const discounted = order(1002, [line('Rice', '1006', 1020)], 'SAVE10');
  const match = order(1008, [line('Tea', '0902', 100)]);
  const cancelled = { ...discounted, id: 1003, status: 'cancelled' };

  const report = getGstReconciliation({ orders: [discounted, match, cancelled] });

  assert.deepEqual([report.totalChecked, report.mismatchCount, report.totalDelta], [2, 0, 0]);
  assert.deepEqual(report.rows.map(row => [
    row.orderId, row.ledgerTax, row.invoiceTax, row.ledgerTotal, row.invoiceTotal, row.delta, row.matched
  ]), [
    [1002, 45.90, 45.90, 963.90, 963.90, 0, true],
    [1008, 18, 18, 118, 118, 0, true]
  ]);
});

test('invoice matches checkout GST and capped coupon totals for mixed HSN rates', () => {
  const sale = order(1009, [
    line('Groundnut oil', '1508', 1000),
    line('Ghee', '0405', 1000)
  ], 'SAVE10');
  const invoice = computeInvoiceFigures(sale);

  assert.deepEqual(
    [invoice.discount, invoice.tax, invoice.cgst, invoice.sgst, invoice.total],
    [150, 157.25, 78.63, 78.62, 2007.25]
  );
  assert.deepEqual(invoice.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]),
    [[5, 46.25], [12, 111]]);
});
