'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function makeOrder(items, coupon) {
  const totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 42,
    date: '15/03/2022',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice uses the billed HSN slab and matches order pricing', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 }];
  const order = makeOrder(items);
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(billed.subtotal, 640);
  assert.equal(billed.tax, 32);
  assert.equal(billed.cgst, 16);
  assert.equal(billed.sgst, 16);
  assert.equal(billed.total, 672);

  assert.equal(printed.subtotal, 640);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
  assert.equal(printed.total, billed.total);
});

test('invoice applies the same capped coupon and post-discount GST as order pricing', function () {
  const items = [{ id: 5, name: 'Groundnut oil', sku: 'OIL-2', hsn: '1508', price: 1120, qty: 2 }];
  const order = makeOrder(items, 'SAVE10');
  const billed = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(billed.subtotal, 2240);
  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 104.5);
  assert.equal(billed.total, 2194.5);

  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.total, billed.total);
});

test('invoice interprets decimal gstRate the same way as order pricing', function () {
  const items = [{ id: 7, name: 'Explicit rate item', price: 100, qty: 1, gstRate: 0.05 }];
  const order = makeOrder(items);
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(billed.lines[0].gstPercent, 5);
  assert.equal(billed.tax, 5);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, billed.total);
});

test('invoice HTML shows separate CGST and SGST amounts', function () {
  const order = makeOrder([{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }]);
  const html = invoice.render(order);

  assert.match(html, /<td>CGST<\/td><td class="r">[^<]*2\.50<\/td>/);
  assert.match(html, /<td>SGST<\/td><td class="r">[^<]*2\.50<\/td>/);
  assert.doesNotMatch(html, /CGST \+ SGST \(Total GST\)/);
});

test('GST reconciliation matches invoice figures to the billed order', function () {
  const order = makeOrder([{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }]);
  const db = { orders: [order], customers: [], products: [] };
  const reconciliation = reports.getGstReconciliation(db);

  assert.equal(order.tax, 5);
  assert.equal(order.total, 105);
  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].invoiceTax, order.tax);
  assert.equal(reconciliation.rows[0].invoiceTotal, order.total);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
