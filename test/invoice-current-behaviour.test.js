'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function order(items, coupon, totals) {
  return Object.assign({
    id: 17,
    date: '2026-11-21',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon || ''
  }, totals || {});
}

test('invoice uses the same HSN slab and totals as order pricing', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }];
  var ledger = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures(order(items, '', { total: ledger.total }));

  assert.equal(ledger.tax, 5);
  assert.equal(ledger.total, 105);
  assert.equal(printed.tax, 5);
  assert.equal(printed.total, 105);
  assert.equal(printed.rows[0].gstPercent, 5);
});

test('invoice applies coupon discount before calculating GST, like order pricing', function () {
  var items = [{ id: 2, name: 'Tea', sku: 'TEA', hsn: '0902', price: 100, qty: 1 }];
  var ledger = pricing.computeTotals(items, 'WELCOME');
  var printed = invoice.computeInvoiceFigures(order(items, 'WELCOME', { total: ledger.total }));

  assert.deepEqual(
    { subtotal: ledger.subtotal, discount: ledger.discount, tax: ledger.tax, total: ledger.total },
    { subtotal: 100, discount: 5, tax: 17.1, total: 112.1 }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, total: printed.total },
    { subtotal: 100, discount: 5, tax: 17.1, total: 112.1 }
  );
  assert.equal(printed.rows[0].gstPercent, 18);
  assert.equal(printed.rows[0].lineTax, 17.1);
});

test('invoice interprets decimal gstRate values the same way as order pricing', function () {
  var printed = invoice.computeInvoiceFigures(order([
    { name: 'Test item', price: 100, qty: 1, gstRate: 0.05 }
  ]));

  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, 5);
  assert.equal(printed.total, 105);
});

test('GST reconciliation reports matching invoice and ledger figures', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }];
  var ledger = pricing.computeTotals(items, '');
  var db = { orders: [order(items, '', ledger)] };

  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 17,
      date: '2026-11-21',
      customer: 'In-memory customer',
      coupon: '',
      ledgerSubtotal: 100,
      ledgerDiscount: 0,
      ledgerTax: 5,
      ledgerTotal: 105,
      invoiceDiscount: 0,
      invoiceTax: 5,
      invoiceTotal: 105,
      delta: 0,
      matched: true
    }]
  });
});

test('rendered invoice shows the recorded total without a reconciliation warning', function () {
  var html = invoice.render(order([
    { name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }
  ], '', { total: 105 }));

  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
