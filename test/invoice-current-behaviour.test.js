'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('CURRENT BEHAVIOUR: ledger pricing applies HSN rates and discounts before tax', function () {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Butter', hsn: '0405', price: 100, qty: 1 }
  ];

  const totals = pricing.computeTotals(items, 'WELCOME');

  assert.equal(totals.subtotal, 200);
  assert.equal(totals.discount, 10);
  assert.equal(totals.lines[0].tax, 4.75);
  assert.equal(totals.lines[1].tax, 11.4);
  assert.equal(totals.tax, 16.15);
  assert.equal(totals.cgst, 8.08);
  assert.equal(totals.sgst, 8.07);
  assert.equal(totals.total, 206.15);
});

test('invoice uses the ledger HSN rates, apportioned discount, and post-discount taxable amount', function () {
  const order = {
    id: 7,
    coupon: 'WELCOME',
    items: [
      { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
      { name: 'Butter', hsn: '0405', price: 100, qty: 1 }
    ]
  };

  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, 200);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[1].gstPercent, 12);
  assert.equal(figures.rows[0].discount, 5);
  assert.equal(figures.rows[0].taxable, 95);
  assert.equal(figures.rows[0].lineTax, 4.75);
  assert.equal(figures.rows[1].discount, 5);
  assert.equal(figures.rows[1].taxable, 95);
  assert.equal(figures.rows[1].lineTax, 11.4);
  assert.equal(figures.tax, 16.15);
  assert.equal(figures.discount, 10);
  assert.equal(figures.cgst, 8.08);
  assert.equal(figures.sgst, 8.07);
  assert.equal(figures.total, 206.15);
});

test('GST reconciliation matches invoice figures to the stored ledger figures', function () {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Butter', hsn: '0405', price: 100, qty: 1 }
  ];
  const totals = pricing.computeTotals(items, 'WELCOME');
  const order = {
    id: 7,
    date: '01/01/2022',
    customer: 'Test customer',
    coupon: 'WELCOME',
    status: 'completed',
    items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };

  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].ledgerTax, 16.15);
  assert.equal(result.rows[0].invoiceTax, 16.15);
  assert.equal(result.rows[0].ledgerTotal, 206.15);
  assert.equal(result.rows[0].invoiceTotal, 206.15);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});

test('CURRENT BEHAVIOUR: unknown coupon code yields no discount, with HSN tax preserved', function () {
  const figures = invoice.computeInvoiceFigures({
    coupon: 'REMOVED',
    items: [{ name: 'Unmapped item', price: 100, qty: 1, hsn: '9999' }]
  });

  assert.equal(figures.rows[0].gstPercent, 18);
  assert.equal(figures.tax, 18);
  assert.equal(figures.discount, 0);
  assert.equal(figures.total, 118);
});
