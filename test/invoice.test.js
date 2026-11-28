'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function makeOrder(items, coupon, totals) {
  return {
    id: 42,
    date: '28/11/2026',
    customer: 'In-memory customer',
    status: 'completed',
    paymentMode: 'cash',
    items: items,
    coupon: coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('correct behaviour: invoice figures match HSN-based billed totals after coupon discount', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const order = makeOrder(items, 'SAVE10', billed);
  const invoiced = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: invoiced.subtotal, discount: invoiced.discount, tax: invoiced.tax, cgst: invoiced.cgst, sgst: invoiced.sgst, total: invoiced.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total }
  );
  assert.equal(invoiced.rows[0].gstPercent, 5);
  assert.equal(invoiced.rows[0].lineTax, 28.8);

  const html = invoice.render(order);
  assert.match(html, /<tr><td>CGST<\/td><td class="r">₹14\.40<\/td><\/tr>/);
  assert.match(html, /<tr><td>SGST<\/td><td class="r">₹14\.40<\/td><\/tr>/);
  assert.match(html, /<tr class="grand"><td>Invoice Total<\/td><td class="r">₹604\.80<\/td><\/tr>/);
});

test('correct behaviour: invoice honors coupon maxDiscount and matches billed amounts', function () {
  const items = [{ id: 2, name: 'Unmapped item', sku: 'OTHER-1', hsn: '9999', price: 5000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'WHOLESALE15');
  const order = makeOrder(items, 'WHOLESALE15', billed);
  const invoiced = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: invoiced.subtotal, discount: invoiced.discount, tax: invoiced.tax, cgst: invoiced.cgst, sgst: invoiced.sgst, total: invoiced.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total }
  );
  assert.equal(invoiced.discount, 400);
  assert.equal(invoiced.total, 5428);
});

test('correct behaviour: GST reconciliation reports invoice totals matched to in-memory order ledger', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const order = makeOrder(items, 'SAVE10', billed);
  const result = reports.getGstReconciliation({
    orders: [order],
    products: [],
    customers: []
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(
    { ledgerTax: result.rows[0].ledgerTax, invoiceTax: result.rows[0].invoiceTax, delta: result.rows[0].delta, matched: result.rows[0].matched },
    { ledgerTax: 45, invoiceTax: 45, delta: 0, matched: true }
  );
});
