'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('CURRENT BEHAVIOUR: order totals use HSN slabs and discount taxable value before GST', () => {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 2, name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
  ];

  const totals = pricing.computeTotals(items, 'SAVE10');

  assert.deepEqual(
    {
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxable: totals.taxable,
      tax: totals.tax,
      cgst: totals.cgst,
      sgst: totals.sgst,
      total: totals.total,
      lineRates: totals.lines.map((line) => line.gstPercent)
    },
    {
      subtotal: 1020,
      discount: 102,
      taxable: 918,
      tax: 45.9,
      cgst: 22.95,
      sgst: 22.95,
      total: 963.9,
      lineRates: [5, 5]
    }
  );
});

test('invoice GST breakdown and total match the order calculation', () => {
  const order = {
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 }],
    coupon: 'SAVE10'
  };

  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
  assert.deepEqual(
    invoiceFigures.rows.map((row) => ({ gstPercent: row.gstPercent, lineTax: row.lineTax })),
    billed.lines.map((line) => ({ gstPercent: line.gstPercent, lineTax: line.tax }))
  );
});

test('invoice applies the same HSN slab, GST, and total as the order calculation', () => {
  const order = {
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 }],
    coupon: ''
  };

  const billed = pricing.computeTotals(order.items, '');
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.tax, 32);
  assert.equal(billed.total, 672);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice applies the same coupon discount to the same taxable value as the order calculation', () => {
  const order = {
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 }],
    coupon: 'WELCOME'
  };

  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 32);
  assert.equal(billed.tax, 30.4);
  assert.equal(billed.total, 638.4);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice respects the configured coupon maximum discount used by the order calculation', () => {
  const order = {
    items: [{ id: 1, name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 }],
    coupon: 'SAVE10'
  };

  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 104.5);
  assert.equal(billed.total, 2194.5);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
});

test('GST reconciliation matches invoice figures to ledger figures for in-memory orders', () => {
  const order = {
    id: 77,
    date: '21/11/2026',
    customer: 'Test customer',
    coupon: 'SAVE10',
    status: 'completed',
    items: [{ id: 1, name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 }],
    subtotal: 2240,
    discount: 150,
    tax: 104.5,
    total: 2194.5
  };

  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].invoiceDiscount, 150);
  assert.equal(result.rows[0].invoiceTax, 104.5);
  assert.equal(result.rows[0].invoiceTotal, 2194.5);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});

test('printable invoice omits the reconciliation notice when totals match', () => {
  const order = {
    id: 78,
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 }],
    coupon: '',
    total: 672
  };

  const html = invoice.render(order);

  assert.match(html, /5%/);
  assert.match(html, /₹32\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹672\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
