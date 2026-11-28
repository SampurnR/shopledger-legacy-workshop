'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function riceOrder(overrides) {
  var order = {
    id: 41,
    date: '28/11/2026',
    customer: 'In-memory customer',
    status: 'completed',
    coupon: '',
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105,
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }]
  };
  Object.keys(overrides || {}).forEach(function (key) {
    order[key] = overrides[key];
  });
  return order;
}

test('invoice HSN GST and total match the amount billed by order pricing', function () {
  var order = riceOrder();
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.rows[0].lineTax, order.tax);
  assert.equal(invoiceFigures.tax, order.tax);
  assert.equal(invoiceFigures.cgst, 2.5);
  assert.equal(invoiceFigures.sgst, 2.5);
  assert.equal(invoiceFigures.total, order.total);
});

test('invoice coupon discount, GST, and total match order pricing caps', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 3000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var order = riceOrder({
    coupon: 'SAVE10', subtotal: billed.subtotal, discount: billed.discount,
    tax: billed.tax, total: billed.total, items: items
  });
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 150);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
});

test('printable invoice displays billed GST and total without a reconciliation warning', function () {
  var html = invoice.render(riceOrder());

  assert.match(html, /GST %<\/th>/);
  assert.match(html, /5%/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹5\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('GST reconciliation matches billed order and omits cancelled orders', function () {
  var completed = riceOrder();
  var cancelled = riceOrder({ id: 42, status: 'cancelled', total: 999, tax: 99 });
  var result = reports.getGstReconciliation({
    orders: [completed, cancelled],
    products: [],
    customers: []
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].orderId, 41);
  assert.equal(result.rows[0].ledgerTax, 5);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});
