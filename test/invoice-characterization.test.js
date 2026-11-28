'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

test('invoice uses the order HSN slab for GST and total', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const invoiced = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(invoiced.rows[0].gstPercent, 5);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.total, billed.total);
});

test('invoice interprets decimal gstRate consistently with order pricing', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', gstRate: 0.05, price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const invoiced = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(billed.tax, 5);
  assert.equal(invoiced.rows[0].gstPercent, 5);
  assert.equal(invoiced.tax, billed.tax);
});

test('invoice applies the same capped coupon discount and post-discount GST as order pricing', function () {
  const items = [{ id: 1, name: 'Coffee', gstRate: 10, price: 2000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const invoiced = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 185);
  assert.equal(billed.total, 2035);
  assert.equal(invoiced.discount, billed.discount);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.total, billed.total);
});

test('invoice does not apply a coupon below its minimum order', function () {
  const order = {
    items: [{ id: 1, name: 'Staples', gstRate: 5, price: 100, qty: 1 }],
    coupon: 'SAVE10'
  };
  const invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(invoiced.subtotal, 100);
  assert.equal(invoiced.discount, 0);
});

test('GST reconciliation matches stored billing figures for an in-memory order', function () {
  const db = {
    products: [],
    customers: [],
    orders: [{
      id: 7,
      date: '28/11/2026',
      customer: 'Walk-in',
      status: 'completed',
      items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
      subtotal: 100,
      discount: 0,
      tax: 5,
      total: 105,
      coupon: ''
    }]
  };

  const result = reports.getGstReconciliation(db);

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[0].invoiceTotal, 105);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});

test('invoice HTML displays the billed total without a mismatch notice when figures match', function () {
  const order = {
    id: 42,
    date: '28/11/2026',
    status: 'completed',
    customer: 'Walk-in',
    paymentMode: 'cash',
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105,
    coupon: ''
  };
  const html = invoice.render(order);

  assert.ok(html.includes('Invoice Total</td><td class="r">\u20b9105.00'));
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
  assert.ok(html.includes('<td>CGST</td><td class="r">\u20b92.50'));
  assert.ok(html.includes('<td>SGST</td><td class="r">\u20b92.50'));
});
