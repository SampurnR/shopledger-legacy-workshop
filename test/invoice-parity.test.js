'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function makeOrder(item, coupon) {
  const totals = pricing.computeTotals([item], coupon || '');
  return {
    id: 9001,
    date: '22/11/2026',
    customer: 'In-memory customer',
    status: 'completed',
    coupon: coupon || '',
    items: [item],
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice uses the order HSN slab and matches billed GST and total', function () {
  const item = { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 };
  const order = makeOrder(item);
  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);
  const html = invoice.render(order);

  assert.equal(billed.tax, 50);
  assert.equal(billed.total, 1050);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
  assert.match(html, /<td class="r">5%<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹50\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹1050\.00/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});

test('invoice applies SAVE10 under the same cap and post-discount tax calculation as billing', function () {
  const item = { id: 2, name: 'Rice bulk pack', sku: 'RICE-2', hsn: '1006', price: 2000, qty: 1 };
  const order = makeOrder(item, 'SAVE10');
  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 92.5);
  assert.equal(billed.total, 1942.5);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice respects FLAT50 minimum order and matches billed totals', function () {
  const item = { id: 3, name: 'Rice small pack', sku: 'RICE-3', hsn: '1006', price: 250, qty: 1 };
  const order = makeOrder(item, 'FLAT50');
  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 0);
  assert.equal(billed.total, 262.5);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
});

test('GST reconciliation reports an active billed order as matched', function () {
  const item = { id: 4, name: 'Rice', sku: 'RICE-4', hsn: '1006', price: 1000, qty: 1 };
  const order = makeOrder(item);
  const reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].ledgerTax, 50);
  assert.equal(reconciliation.rows[0].invoiceTax, 50);
  assert.equal(reconciliation.rows[0].ledgerTotal, 1050);
  assert.equal(reconciliation.rows[0].invoiceTotal, 1050);
  assert.equal(reconciliation.rows[0].matched, true);
});

test('invoice interprets decimal gstRate the same way as billing', function () {
  const item = { id: 5, name: 'Rice', sku: 'RICE-5', hsn: '1006', gstRate: 0.05, price: 1000, qty: 1 };
  const order = makeOrder(item);
  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.tax, 50);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
});
