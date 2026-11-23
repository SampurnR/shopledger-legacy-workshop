'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function riceOrder() {
  const items = [{
    id: 1,
    sku: 'RICE-1',
    name: 'Rice',
    hsn: '1006',
    price: 640,
    qty: 1
  }];
  const totals = pricing.computeTotals(items, 'SAVE10');

  return {
    id: 1001,
    date: '23/11/2026',
    customer: 'Test customer',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon: 'SAVE10',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('CURRENT BEHAVIOUR: order pricing uses HSN GST and discounts subtotal before tax', () => {
  const order = riceOrder();
  const totals = pricing.computeTotals(order.items, order.coupon);

  assert.equal(totals.subtotal, 640);
  assert.equal(totals.discount, 64);
  assert.equal(totals.taxable, 576);
  assert.equal(totals.tax, 28.8);
  assert.equal(totals.cgst, 14.4);
  assert.equal(totals.sgst, 14.4);
  assert.equal(totals.total, 604.8);
  assert.deepEqual(totals.lines[0], {
    id: 1,
    name: 'Rice',
    hsn: '1006',
    gstPercent: 5,
    gross: 640,
    discount: 64,
    taxable: 576,
    tax: 28.8,
    net: 604.8
  });
});

test('invoice figures use the order pricing HSN GST slab and coupon calculation', () => {
  const order = riceOrder();
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, 640);
  assert.equal(figures.tax, 28.8);
  assert.equal(figures.discount, 64);
  assert.equal(figures.cgst, 14.4);
  assert.equal(figures.sgst, 14.4);
  assert.equal(figures.total, 604.8);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 28.8);
  assert.equal(figures.total, order.total);
});

test('GST reconciliation reports matching in-memory ledger and invoice calculations', () => {
  const order = riceOrder();
  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 1001,
    date: '23/11/2026',
    customer: 'Test customer',
    coupon: 'SAVE10',
    ledgerSubtotal: 640,
    ledgerDiscount: 64,
    ledgerTax: 28.8,
    ledgerTotal: 604.8,
    invoiceDiscount: 64,
    invoiceTax: 28.8,
    invoiceTotal: 604.8,
    delta: 0,
    matched: true
  });
});
