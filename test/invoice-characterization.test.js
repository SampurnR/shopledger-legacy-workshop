'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice figures match the totals billed by order pricing', function () {
  var items = [{ id: 4, name: 'Rice', sku: 'RICE', hsn: '1006', price: 1000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'WELCOME');
  var invoiceFigures = invoice.computeInvoiceFigures({
    id: 9,
    items: items,
    coupon: 'WELCOME',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });

  assert.equal(invoiceFigures.subtotal, billed.subtotal);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice uses the same HSN slab as order pricing', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }];
  var ledger = pricing.computeTotals(items, '');
  var billedOrder = {
    id: 10,
    items: items,
    subtotal: ledger.subtotal,
    discount: ledger.discount,
    tax: ledger.tax,
    total: ledger.total
  };
  var invoiceFigures = invoice.computeInvoiceFigures(billedOrder);

  assert.equal(ledger.tax, 5);
  assert.equal(ledger.total, 105);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
});

test('invoice percentage coupon matches the order discount and discounted GST', function () {
  var items = [{ id: 2, name: 'Tea', sku: 'TEA', hsn: '0902', price: 1000, qty: 1 }];
  var ledger = pricing.computeTotals(items, 'WELCOME');
  var invoiceFigures = invoice.computeInvoiceFigures({
    id: 11,
    items: items,
    coupon: 'WELCOME',
    subtotal: ledger.subtotal,
    discount: ledger.discount,
    tax: ledger.tax,
    total: ledger.total
  });

  assert.equal(ledger.discount, 50);
  assert.equal(ledger.tax, 171);
  assert.equal(ledger.total, 1121);
  assert.equal(invoiceFigures.discount, 50);
  assert.equal(invoiceFigures.tax, 171);
  assert.equal(invoiceFigures.total, 1121);
});

test('invoice applies a valid flat coupon using order pricing rules', function () {
  var invoiceFigures = invoice.computeInvoiceFigures({
    id: 12,
    items: [{ id: 3, name: 'Eligible item', price: 300, qty: 1 }],
    coupon: 'FLAT50'
  });

  assert.equal(invoiceFigures.subtotal, 300);
  assert.equal(invoiceFigures.discount, 50);
  assert.equal(invoiceFigures.tax, 45);
  assert.equal(invoiceFigures.total, 295);
});

test('reconciliation excludes cancelled orders and matches billed figures', function () {
  var items = [{ name: 'Item', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var db = {
    orders: [
      { id: 20, items: items, subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
      { id: 21, status: 'cancelled', items: [{ name: 'Item', price: 100, qty: 1 }], tax: 0, total: 0 }
    ]
  };
  var result = reports.getGstReconciliation(db);

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].matched, true);
  assert.equal(result.rows[0].ledgerSubtotal, billed.subtotal);
  assert.equal(result.rows[0].ledgerDiscount, billed.discount);
});

test('invoice renders billed GST and omits the reconciliation notice for a matched order', function () {
  var html = invoice.render({
    id: 22,
    date: '2026-11-28',
    items: [{ name: 'Rice', price: 100, qty: 1, hsn: '1006' }],
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  });

  assert.match(html, /5%<\/td><td class="r">₹5\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
