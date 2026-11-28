'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function mixedHsnItems(price) {
  return [
    { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: price, qty: 1 },
    { id: 2, sku: 'TEA-1', name: 'Tea', hsn: '0902', price: price, qty: 1 }
  ];
}

function summarizeInvoice(figures) {
  return {
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    gstPercent: figures.rows.map(function (row) { return row.gstPercent; }),
    lineTax: figures.rows.map(function (row) { return row.lineTax; })
  };
}

function summarizeBill(totals) {
  return {
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    cgst: totals.cgst,
    sgst: totals.sgst,
    total: totals.total,
    gstPercent: totals.lines.map(function (line) { return line.gstPercent; }),
    lineTax: totals.lines.map(function (line) { return line.tax; })
  };
}

test('invoice matches the bill using each item HSN rate', function () {
  const items = mixedHsnItems(100);
  const billed = pricing.computeTotals(items, '');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(summarizeInvoice(invoiceFigures), summarizeBill(billed));
  assert.deepEqual(summarizeInvoice(invoiceFigures), {
    subtotal: 200,
    discount: 0,
    tax: 23,
    cgst: 11.5,
    sgst: 11.5,
    total: 223,
    gstPercent: [5, 18],
    lineTax: [5, 18]
  });
});

test('invoice matches the bill using the capped coupon and post-discount GST', function () {
  const items = mixedHsnItems(1500);
  const billed = pricing.computeTotals(items, 'WHOLESALE15');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'WHOLESALE15' });

  assert.deepEqual(summarizeInvoice(invoiceFigures), summarizeBill(billed));
  assert.deepEqual(summarizeInvoice(invoiceFigures), {
    subtotal: 3000,
    discount: 400,
    tax: 299,
    cgst: 149.5,
    sgst: 149.5,
    total: 2899,
    gstPercent: [5, 18],
    lineTax: [65, 234]
  });
});

test('GST reconciliation reports matching invoice and ledger totals', function () {
  const items = mixedHsnItems(1500);
  const billed = pricing.computeTotals(items, 'WHOLESALE15');
  const order = {
    id: 77,
    date: '01/02/2026',
    customer: 'In-memory customer',
    coupon: 'WHOLESALE15',
    items: items,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };

  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].matched, true);
  assert.equal(result.rows[0].invoiceTax, billed.tax);
  assert.equal(result.rows[0].invoiceTotal, billed.total);
});
