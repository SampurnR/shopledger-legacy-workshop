'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function makeOrder(overrides) {
  var order = {
    id: 42,
    date: '21/11/2026',
    customer: 'Test Customer',
    paymentMode: 'cash',
    status: 'completed',
    coupon: 'SAVE10',
    items: [{
      id: 1,
      sku: 'RICE-1',
      name: 'Rice',
      hsn: '1006',
      price: 600,
      qty: 1
    }]
  };

  Object.assign(order, overrides || {});
  var totals = pricing.computeTotals(order.items, order.coupon);
  order.subtotal = totals.subtotal;
  order.discount = totals.discount;
  order.tax = totals.tax;
  order.total = totals.total;
  return order;
}

test('pricing applies the HSN slab after applying the coupon discount', function () {
  var order = makeOrder();
  var totals = pricing.computeTotals(order.items, order.coupon);

  assert.equal(totals.subtotal, 600);
  assert.equal(totals.discount, 60);
  assert.equal(totals.tax, 27);
  assert.equal(totals.total, 567);
  assert.equal(totals.lines[0].gstPercent, 5);
  assert.equal(totals.lines[0].taxable, 540);
});

test('invoice figures match the totals and GST charged when placing an order', function () {
  var order = makeOrder();
  var billed = pricing.computeTotals(order.items, order.coupon);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, billed.subtotal);
  assert.equal(figures.discount, billed.discount);
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.cgst, billed.cgst);
  assert.equal(figures.sgst, billed.sgst);
  assert.equal(figures.total, billed.total);
  assert.equal(figures.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(figures.rows[0].lineTax, billed.lines[0].tax);
});

test('invoice uses the HSN slab and splits its GST between CGST and SGST', function () {
  var order = makeOrder();
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.items[0].hsn, '1006');
  assert.equal(order.items[0].gstRate, undefined);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 27);
  assert.equal(figures.cgst, 13.5);
  assert.equal(figures.sgst, 13.5);
});

test('invoice uses the same subtotal-based coupon discount as order pricing', function () {
  var order = makeOrder();
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 60);
  assert.equal(figures.discount, 60);
  assert.equal(order.total, 567);
  assert.equal(figures.total, 567);
});

test('invoice HTML shows the billed total without a reconciliation warning when figures match', function () {
  var html = invoice.render(makeOrder());

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹567\.00/);
});

test('GST reconciliation reports matching figures for a placed order', function () {
  var order = makeOrder();
  var result = reports.getGstReconciliation({
    products: [],
    customers: [],
    orders: [order]
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].matched, true);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].invoiceTax, 27);
  assert.equal(result.rows[0].ledgerTax, 27);
});

test('CURRENT BEHAVIOUR: GST reconciliation excludes cancelled orders', function () {
  var order = makeOrder({ status: 'cancelled' });
  var result = reports.getGstReconciliation({
    products: [],
    customers: [],
    orders: [order]
  });

  assert.equal(result.totalChecked, 0);
  assert.equal(result.mismatchCount, 0);
  assert.deepEqual(result.rows, []);
});
