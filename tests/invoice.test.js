var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function makeOrder(items, coupon) {
  var totals = pricing.computeTotals(items, coupon);
  return {
    id: 41,
    date: '2026-11-15',
    customer: 'Test Customer',
    paymentMode: 'cash',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice uses the HSN slab used at checkout', function () {
  var order = makeOrder([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ]);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 5);
  assert.equal(order.total, 105);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
});

test('invoice applies coupon discount before GST as checkout does', function () {
  var order = makeOrder([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ], 'WELCOME');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 5);
  assert.equal(order.tax, 4.75);
  assert.equal(order.total, 99.75);
  assert.equal(figures.discount, 5);
  assert.equal(figures.tax, 4.75);
  assert.equal(figures.total, 99.75);
});

test('GST reconciliation matches figures recorded at checkout', function () {
  var order = makeOrder([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ], 'WELCOME');
  var result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].matched, true);
  assert.equal(result.rows[0].delta, 0);
});

test('rendered invoice shows checkout GST and total without a mismatch notice', function () {
  var order = makeOrder([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ], 'WELCOME');
  var html = invoice.render(order);

  assert.match(html, /GST %<\/th><th class="r">GST Amt/);
  assert.match(html, /<td class="r">5%<\/td>/);
  assert.match(html, /₹4\.75<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹99\.75/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice accepts a decimal gstRate in the same form as checkout', function () {
  var order = {
    id: 42,
    items: [{ name: 'Legacy Item', hsn: '1006', gstRate: 0.05, price: 100, qty: 1 }],
    coupon: ''
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
});
