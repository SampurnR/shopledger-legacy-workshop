'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function orderFor(item, values) {
  return Object.assign({
    id: 77,
    date: '15/03/2022',
    customer: 'Test Customer',
    paymentMode: 'cash',
    status: 'completed',
    coupon: '',
    items: [item],
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0
  }, values || {});
}

test('invoice total and GST match the amount billed at checkout', function () {
  var item = { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 };
  var checkout = pricing.computeTotals([item], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(orderFor(item, { coupon: 'SAVE10' }));

  assert.equal(figures.subtotal, checkout.subtotal);
  assert.equal(figures.discount, checkout.discount);
  assert.equal(figures.tax, checkout.tax);
  assert.equal(figures.total, checkout.total);
  assert.equal(figures.rows[0].gstPercent, checkout.lines[0].gstPercent);
  assert.equal(figures.rows[0].lineTax, checkout.lines[0].tax);
});

test('CURRENT BEHAVIOUR: checkout resolves the rice HSN slab and discounts before calculating GST', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 }];
  var totals = pricing.computeTotals(items, 'SAVE10');

  assert.deepEqual({
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    tax: totals.tax,
    total: totals.total,
    gstPercent: totals.lines[0].gstPercent
  }, {
    subtotal: 640,
    discount: 64,
    taxable: 576,
    tax: 28.8,
    total: 604.8,
    gstPercent: 5
  });
});

test('invoice uses the HSN slab and matches checkout when no coupon is applied', function () {
  var order = orderFor({ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 });
  var checkout = pricing.computeTotals(order.items, '');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.rows[0].hsn, '1006');
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 32);
  assert.equal(figures.tax, checkout.tax);
  assert.equal(figures.total, checkout.total);
});

test('invoice uses checkout discount, GST, and total for a HSN-rated coupon order', function () {
  var item = { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 };
  var order = orderFor(item, { coupon: 'SAVE10' });
  var checkout = pricing.computeTotals([item], order.coupon);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(checkout.discount, 64);
  assert.equal(checkout.tax, 28.8);
  assert.equal(checkout.total, 604.8);
  assert.equal(figures.discount, checkout.discount);
  assert.equal(figures.tax, checkout.tax);
  assert.equal(figures.total, checkout.total);
  assert.equal(figures.rows[0].gstPercent, checkout.lines[0].gstPercent);
  assert.equal(figures.rows[0].lineTax, checkout.lines[0].tax);
});

test('invoice HTML shows checkout GST and total without a reconciliation warning', function () {
  var order = orderFor(
    { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 },
    { total: 604.8, coupon: 'SAVE10' }
  );
  var html = invoice.render(order);

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /<td class="r">5%<\/td>/);
  assert.match(html, /₹28\.80/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹604\.80/);
  assert.match(html, /CGST \+ SGST \(Total GST\)/);
  assert.doesNotMatch(html, />CGST<|>SGST</);
});

test('reconciliation marks the checkout and invoice matched when their totals and GST agree', function () {
  var item = { id: 8, name: 'Tea', sku: 'BEV-001', hsn: '0902', price: 1000, qty: 1 };
  var checkout = pricing.computeTotals([item], 'SAVE10');
  var inMemoryDb = { orders: [orderFor(item, {
    coupon: 'SAVE10',
    subtotal: checkout.subtotal,
    discount: checkout.discount,
    tax: checkout.tax,
    total: checkout.total
  })] };
  var result = reports.getGstReconciliation(inMemoryDb);

  assert.equal(checkout.total, 1062);
  assert.equal(result.rows[0].invoiceTotal, 1062);
  assert.equal(result.rows[0].ledgerTax, 162);
  assert.equal(result.rows[0].invoiceTax, 162);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
});

test('CURRENT BEHAVIOUR: tax uses explicit gstRate when truthy, otherwise HSN slab or default rate', function () {
  assert.equal(tax.getRateForItem({ gstRate: 12 }), 0.12);
  assert.equal(tax.getRateForItem({ hsn: '0405' }), 0.12);
  assert.equal(tax.getRateForItem({ hsn: 'unknown' }), 0.18);
});
