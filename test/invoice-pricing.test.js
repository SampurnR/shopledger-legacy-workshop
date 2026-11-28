'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

// The order route stores these fields on line items; it does not store gstRate.
function makeOrder(coupon) {
  const items = [{
    id: 1,
    sku: 'GRN-001',
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 1
  }];
  const totals = pricing.computeTotals(items, coupon || '');

  return {
    id: 1001,
    date: '01/04/2026',
    customer: 'In-memory customer',
    status: 'completed',
    paymentMode: 'cash',
    coupon: coupon || '',
    items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('CURRENT BEHAVIOUR: order pricing uses the HSN slab on the post-discount taxable amount', () => {
  const totals = pricing.computeTotals([{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 1
  }], 'WELCOME');

  assert.equal(totals.subtotal, 100);
  assert.equal(totals.discount, 5);
  assert.equal(totals.taxable, 95);
  assert.equal(totals.tax, 4.75);
  assert.equal(totals.total, 99.75);
  assert.equal(totals.lines[0].gstPercent, 5);
});

test('invoice uses the HSN slab and matches an order without a coupon', () => {
  const calculated = invoice.computeInvoiceFigures(makeOrder(''));

  assert.equal(calculated.subtotal, 100);
  assert.equal(calculated.rows[0].hsn, '1006');
  assert.equal(calculated.rows[0].gstPercent, 5);
  assert.equal(calculated.tax, 5);
  assert.equal(calculated.cgst, 2.5);
  assert.equal(calculated.sgst, 2.5);
  assert.equal(calculated.total, 105);
});

test('invoice matches billed discount, GST, and total for a coupon order', () => {
  const order = makeOrder('WELCOME');
  const calculated = invoice.computeInvoiceFigures(order);

  assert.equal(order.total, 99.75);
  assert.equal(order.tax, 4.75);
  assert.equal(calculated.subtotal, 100);
  assert.equal(calculated.rows[0].lineTax, 4.75);
  assert.equal(calculated.tax, order.tax);
  assert.equal(calculated.discount, order.discount);
  assert.equal(calculated.total, order.total);
});

test('GST reconciliation reports no mismatch when invoice matches billed order', () => {
  const order = makeOrder('WELCOME');
  const reconciliation = reports.getGstReconciliation({
    orders: [order]
  });

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].ledgerTax, 4.75);
  assert.equal(reconciliation.rows[0].invoiceTax, 4.75);
  assert.equal(reconciliation.rows[0].ledgerTotal, 99.75);
  assert.equal(reconciliation.rows[0].invoiceTotal, 99.75);
  assert.equal(reconciliation.rows[0].matched, true);
});
