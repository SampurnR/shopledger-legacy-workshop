'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('CURRENT BEHAVIOUR: pricing applies HSN slabs and coupon discount before GST', function () {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 140, qty: 1 }
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
      lines: totals.lines.map(function (line) {
        return { gstPercent: line.gstPercent, taxable: line.taxable, tax: line.tax };
      })
    },
    {
      subtotal: 780,
      discount: 78,
      taxable: 702,
      tax: 51.48,
      cgst: 25.74,
      sgst: 25.74,
      total: 753.48,
      lines: [
        { gstPercent: 5, taxable: 576, tax: 28.8 },
        { gstPercent: 18, taxable: 126, tax: 22.68 }
      ]
    }
  );
});

test('invoice uses billed HSN rates and applies coupon discount before GST', function () {
  const order = {
    id: 71,
    coupon: 'SAVE10',
    items: [
      { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 },
      { id: 2, name: 'Tea', sku: 'TEA-1', hsn: '0902', price: 140, qty: 1 }
    ]
  };

  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      subtotal: figures.subtotal,
      discount: figures.discount,
      tax: figures.tax,
      cgst: figures.cgst,
      sgst: figures.sgst,
      total: figures.total,
      lines: figures.rows.map(function (line) {
        return { gstPercent: line.gstPercent, lineTax: line.lineTax };
      })
    },
    {
      subtotal: 780,
      discount: 78,
      tax: 51.48,
      cgst: 25.74,
      sgst: 25.74,
      total: 753.48,
      lines: [
        { gstPercent: 5, lineTax: 28.8 },
        { gstPercent: 18, lineTax: 22.68 }
      ]
    }
  );
});

test('GST reconciliation matches the in-memory billed order and its invoice', function () {
  const billed = pricing.computeTotals([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 },
    { id: 2, name: 'Tea', sku: 'TEA-1', hsn: '0902', price: 140, qty: 1 }
  ], 'SAVE10');

  // In-memory fixture only; the report receives this object directly.
  const db = {
    orders: [{
      id: 71,
      date: '28/11/2026',
      customer: 'Test Customer',
      coupon: 'SAVE10',
      status: 'completed',
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total,
      items: [
        { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 },
        { id: 2, name: 'Tea', sku: 'TEA-1', hsn: '0902', price: 140, qty: 1 }
      ]
    }]
  };

  const reconciliation = reports.getGstReconciliation(db);

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.deepEqual(
    {
      ledgerTax: reconciliation.rows[0].ledgerTax,
      invoiceTax: reconciliation.rows[0].invoiceTax,
      ledgerTotal: reconciliation.rows[0].ledgerTotal,
      invoiceTotal: reconciliation.rows[0].invoiceTotal,
      delta: reconciliation.rows[0].delta,
      matched: reconciliation.rows[0].matched
    },
    {
      ledgerTax: 51.48,
      invoiceTax: 51.48,
      ledgerTotal: 753.48,
      invoiceTotal: 753.48,
      delta: 0,
      matched: true
    }
  );
});

test('invoice splits billed HSN GST equally', function () {
  const figures = invoice.computeInvoiceFigures({
    coupon: '',
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  });

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.cgst, 2.5);
  assert.equal(figures.sgst, 2.5);
  assert.equal(figures.total, 105);
});
