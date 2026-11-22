'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

function line(overrides) {
  return Object.assign({
    id: 7,
    sku: 'SKU-7',
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 1
  }, overrides || {});
}

function totals(figures) {
  return {
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total
  };
}

test('invoice HSN tax and total match the amounts billed by order pricing', function () {
  // This mirrors the line shape persisted by routes/orders.js: HSN is present; gstRate is not.
  const item = line();
  const billed = pricing.computeTotals([item], '');
  const printed = invoice.computeInvoiceFigures({ items: [item], coupon: '' });

  assert.deepEqual(totals(printed), totals(billed));
  assert.deepEqual(totals(printed), {
    subtotal: 100,
    discount: 0,
    tax: 5,
    cgst: 2.5,
    sgst: 2.5,
    total: 105
  });
});

test('invoice coupon discount and GST match the amounts billed by order pricing', function () {
  const item = line({ hsn: '0902', price: 2000 });
  const billed = pricing.computeTotals([item], 'SAVE10');
  const printed = invoice.computeInvoiceFigures({ items: [item], coupon: 'SAVE10' });

  assert.deepEqual(totals(printed), totals(billed));
  assert.deepEqual(totals(printed), {
    subtotal: 2000,
    discount: 150,
    tax: 333,
    cgst: 166.5,
    sgst: 166.5,
    total: 2183
  });
});

test('invoice renderer omits reconciliation warning when invoice matches billed total', function () {
  const item = line();
  const billed = pricing.computeTotals([item], '');
  const html = invoice.render({
    id: 1001,
    date: '22/11/2026',
    customer: 'Walk-in',
    paymentMode: 'cash',
    status: 'completed',
    coupon: '',
    items: [item],
    total: billed.total
  });

  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
  assert.match(html, /Invoice Total.*105\.00/);
});