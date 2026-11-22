'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function sampleOrder() {
  const items = [{
    id: 1,
    name: 'Rice',
    sku: 'RICE-001',
    hsn: '1006',
    price: 500,
    qty: 1
  }];
  const totals = pricing.computeTotals(items, 'SAVE10');

  return {
    id: 42,
    date: '22/11/2026',
    customer: 'Test Customer',
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

test('CURRENT BEHAVIOUR — order pricing applies HSN GST after the coupon discount', function () {
  const order = sampleOrder();
  const totals = pricing.computeTotals(order.items, order.coupon);

  assert.equal(totals.subtotal, 500);
  assert.equal(totals.discount, 50);
  assert.equal(totals.tax, 22.5);
  assert.equal(totals.cgst, 11.25);
  assert.equal(totals.sgst, 11.25);
  assert.equal(totals.total, 472.5);
  assert.deepEqual(
    { gstPercent: totals.lines[0].gstPercent, taxable: totals.lines[0].taxable, tax: totals.lines[0].tax },
    { gstPercent: 5, taxable: 450, tax: 22.5 }
  );
});

test('INVOICE CORRECT BEHAVIOUR — invoice breakdown matches the billed order', function () {
  const order = sampleOrder();
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, order.subtotal);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.cgst, 11.25);
  assert.equal(figures.sgst, 11.25);
  assert.equal(figures.total, order.total);
  assert.deepEqual(
    { gstPercent: figures.rows[0].gstPercent, lineTax: figures.rows[0].lineTax },
    { gstPercent: 5, lineTax: 22.5 }
  );
});

test('INVOICE FIX — invoice uses HSN GST and the billed discount', function () {
  const figures = invoice.computeInvoiceFigures(sampleOrder());

  assert.equal(figures.subtotal, 500);
  assert.equal(figures.tax, 22.5);
  assert.equal(figures.cgst, 11.25);
  assert.equal(figures.sgst, 11.25);
  assert.equal(figures.discount, 50);
  assert.equal(figures.total, 472.5);
  assert.deepEqual(
    { gstPercent: figures.rows[0].gstPercent, lineTax: figures.rows[0].lineTax },
    { gstPercent: 5, lineTax: 22.5 }
  );
});

test('INVOICE FIX — GST reconciliation matches the billed order', function () {
  const order = sampleOrder();
  const result = reports.getGstReconciliation({
    orders: [order],
    products: [],
    customers: []
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].ledgerTax, 22.5);
  assert.equal(result.rows[0].invoiceTax, 22.5);
  assert.equal(result.rows[0].ledgerTotal, 472.5);
  assert.equal(result.rows[0].invoiceTotal, 472.5);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});
