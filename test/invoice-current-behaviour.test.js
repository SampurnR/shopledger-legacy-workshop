'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

// Pure in-memory fixtures only: these tests never load lib/store or data/db.json.
function line(overrides) {
  return Object.assign({ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 1 }, overrides);
}

test('invoice and order pricing use the same HSN slab', () => {
  const items = [line()];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items, coupon: '' });

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(printed.tax, 5);
  assert.equal(printed.total, 105);
});

test('invoice and order pricing apply WELCOME discount before GST', () => {
  const items = [line({ price: 100 })];
  const billed = pricing.computeTotals(items, 'WELCOME');
  const printed = invoice.computeInvoiceFigures({ items, coupon: 'WELCOME' });

  assert.equal(billed.discount, 5);
  assert.equal(billed.tax, 4.75);
  assert.equal(billed.total, 99.75);
  assert.equal(printed.discount, 5);
  assert.equal(printed.tax, 4.75);
  assert.equal(printed.total, 99.75);
});

test('invoice rows and rendered GST breakdown match order pricing', () => {
  const order = { id: 7, items: [line()], coupon: '', total: 105, date: '2026-01-01' };
  const figures = invoice.computeInvoiceFigures(order);
  const html = invoice.render(order);

  assert.deepEqual(figures.rows[0], {
    name: 'Rice', sku: 'RICE-1', hsn: '1006', qty: 1, price: 100,
    gstPercent: 5, line: 100, lineTax: 5
  });
  assert.match(html, />CGST</);
  assert.match(html, />SGST</);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});

test('CURRENT BEHAVIOUR: GST reconciliation flags a tax mismatch even when invoice and ledger totals match', () => {
  const db = { products: [], customers: [], orders: [{
    id: 7, date: '2026-01-01', customer: 'Walk-in', status: 'completed',
    items: [line()], coupon: '', subtotal: 100, discount: 0, tax: 18, total: 105
  }] };
  const result = reports.getGstReconciliation(db);

  assert.equal(result.totalChecked, 1);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, false);
  assert.equal(result.mismatchCount, 1);
});
