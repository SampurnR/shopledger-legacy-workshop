'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');
var invoice = require('../lib/invoice');

test('invoice uses the order HSN slab when calculating GST', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var orderTotals = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(orderTotals.tax, 5);
  assert.equal(orderTotals.total, 105);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
});

test('invoice uses checkout coupon limits and calculates GST after the discount', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];
  var orderTotals = pricing.computeTotals(items, 'WELCOME');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  // Checkout applies 5% to the subtotal, then calculates GST on the discounted value.
  assert.equal(orderTotals.discount, 50);
  assert.equal(orderTotals.tax, 47.5);
  assert.equal(orderTotals.total, 997.5);

  assert.equal(invoiceFigures.discount, orderTotals.discount);
  assert.equal(invoiceFigures.tax, orderTotals.tax);
  assert.equal(invoiceFigures.total, orderTotals.total);
});

test('invoice GST rows use the checkout post-discount taxable amount', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', gstRate: 5, price: 10, qty: 1 }];
  var orderTotals = pricing.computeTotals(items, 'WELCOME');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.equal(orderTotals.lines[0].taxable, 9.5);
  assert.equal(orderTotals.lines[0].tax, 0.48);
  assert.equal(invoiceFigures.rows[0].line, 9.5);
  assert.equal(invoiceFigures.rows[0].lineTax, 0.48);
});

test('CURRENT BEHAVIOUR: tax resolver treats numeric gstRate values at or below 1 as decimal rates', function () {
  assert.equal(tax.getRateForItem({ gstRate: 0.18 }), 0.18);
  assert.equal(tax.getRateForItem({ gstRate: 18 }), 0.18);
  assert.equal(tax.getRateForItem({ hsn: '1006' }), 0.05);
});

test('invoice rendering agrees with the recorded checkout total and has no mismatch warning', function () {
  var html = invoice.render({
    id: 12,
    date: '2026-11-21',
    total: 105,
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: ''
  });

  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice matches the order total and HSN GST breakdown billed at checkout', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 }];
  var orderTotals = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '', total: orderTotals.total });

  assert.equal(invoiceFigures.tax, orderTotals.tax);
  assert.equal(invoiceFigures.total, orderTotals.total);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.rows[0].lineTax, 32);
});

test('invoice retains persisted billed figures if current pricing rules would calculate different totals', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 }];
  var invoiceFigures = invoice.computeInvoiceFigures({
    items: items,
    coupon: '',
    subtotal: 640,
    discount: 0,
    tax: 64,
    total: 704
  });

  assert.equal(invoiceFigures.tax, 64);
  assert.equal(invoiceFigures.cgst, 32);
  assert.equal(invoiceFigures.sgst, 32);
  assert.equal(invoiceFigures.total, 704);
  assert.equal(invoiceFigures.breakdownAvailable, false);
  assert.equal(invoiceFigures.rows.length, 0);
});

test('invoice preserves checkout GST splitting for odd-cent tax amounts', function () {
  var invoiceFigures = invoice.computeInvoiceFigures({
    items: [{ id: 1, name: 'Sample', gstRate: 5, price: 0.1, qty: 1 }],
    coupon: ''
  });

  assert.equal(invoiceFigures.tax, 0.01);
  assert.equal(invoiceFigures.cgst, 0.01);
  assert.equal(invoiceFigures.sgst, 0);
});
