'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('invoice uses the checkout GST breakdown and total', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  const checkout = pricing.computeTotals(items, '');
  const printedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(printedInvoice.tax, checkout.tax);
  assert.equal(printedInvoice.cgst, checkout.cgst);
  assert.equal(printedInvoice.sgst, checkout.sgst);
  assert.equal(printedInvoice.total, checkout.total);
});

test('invoice uses the HSN slab and line GST from checkout', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  const checkout = pricing.computeTotals(items, '');
  const printedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(checkout.tax, 5);
  assert.equal(checkout.total, 105);
  assert.equal(printedInvoice.rows[0].gstPercent, 5);
  assert.equal(printedInvoice.rows[0].lineTax, checkout.lines[0].tax);
  assert.equal(printedInvoice.tax, checkout.tax);
  assert.equal(printedInvoice.total, checkout.total);
});

test('invoice uses checkout coupon discount and post-discount GST totals', function () {
  const items = [{ id: 2, name: 'Rice', sku: 'RICE-2', hsn: '1006', price: 2000, qty: 1 }];
  const checkout = pricing.computeTotals(items, 'SAVE10');
  const printedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(checkout.discount, 150);
  assert.equal(checkout.tax, 92.5);
  assert.equal(checkout.total, 1942.5);
  assert.equal(printedInvoice.rows[0].gstPercent, 5);
  assert.equal(printedInvoice.tax, checkout.tax);
  assert.equal(printedInvoice.discount, checkout.discount);
  assert.equal(printedInvoice.total, checkout.total);
});

test('GST reconciliation reports matching invoice totals and excludes cancelled orders', function () {
  const db = {
    orders: [
      {
        id: 41,
        date: '28/11/2026',
        customer: 'Walk-in',
        status: 'completed',
        items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }],
        coupon: '',
        subtotal: 100,
        discount: 0,
        tax: 5,
        total: 105
      },
      {
        id: 42,
        status: 'cancelled',
        items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
        coupon: '',
        subtotal: 100,
        discount: 0,
        tax: 5,
        total: 105
      }
    ]
  };

  const result = reports.getGstReconciliation(db);

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].orderId, 41);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});
