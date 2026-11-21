'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice GST and total match the amount charged for HSN slab items', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var ledger = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(ledger.tax, 5);
  assert.equal(ledger.total, 105);
  assert.equal(printed.tax, ledger.tax);
  assert.equal(printed.total, ledger.total);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.rows[0].lineTax, 5);
});

test('invoice percentage coupon uses the same discount and total as the order charge', function () {
  var order = {
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: 'WELCOME'
  };
  var ledger = pricing.computeTotals(order.items, order.coupon);
  var printed = invoice.computeInvoiceFigures(order);

  assert.equal(ledger.discount, 5);
  assert.equal(ledger.total, 99.75);
  assert.equal(printed.discount, ledger.discount);
  assert.equal(printed.total, ledger.total);
});

test('invoice applies coupon cap consistently with the order charge', function () {
  var items = [{ name: 'Staples', price: 3000, qty: 1, gstRate: 0 }];
  var ledger = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(ledger.discount, 150);
  assert.equal(printed.discount, ledger.discount);
  assert.equal(printed.total, ledger.total);
});

test('invoice displays the CGST and SGST split used by pricing', function () {
  var printed = invoice.computeInvoiceFigures({
    items: [
      { name: 'A', price: 0.05, qty: 1, gstRate: 10 },
      { name: 'B', price: 0.05, qty: 1, gstRate: 10 }
    ]
  });

  assert.equal(printed.tax, 0.02);
  assert.equal(printed.cgst, 0.01);
  assert.equal(printed.sgst, 0.01);
});

test('GST reconciliation matches in-memory orders billed with HSN slab pricing', function () {
  var db = {
    orders: [{
      id: 42,
      date: '2026-11-21',
      customer: 'In-memory customer',
      items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
      coupon: '',
      subtotal: 100,
      discount: 0,
      tax: 5,
      total: 105
    }],
    products: [],
    customers: [],
    settlements: []
  };
  var result = reports.getGstReconciliation(db);

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].ledgerTotal, 105);
  assert.equal(result.rows[0].invoiceTotal, 105);
  assert.equal(result.rows[0].delta, 0);
});
