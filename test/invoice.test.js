'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('invoice totals and GST breakdown match the billed checkout totals', function () {
  var items = [{ id: 4, name: 'Oil', sku: 'OIL', hsn: '1512', price: 190, qty: 2 }];
  var checkout = pricing.computeTotals(items, 'WELCOME');
  var figures = invoice.computeInvoiceFigures({
    id: 4,
    items: items,
    coupon: 'WELCOME',
    total: checkout.total
  });

  assert.equal(figures.subtotal, checkout.subtotal);
  assert.equal(figures.discount, checkout.discount);
  assert.equal(figures.tax, checkout.tax);
  assert.equal(figures.cgst, checkout.cgst);
  assert.equal(figures.sgst, checkout.sgst);
  assert.equal(figures.total, checkout.total);
  assert.equal(figures.rows[0].gstPercent, checkout.lines[0].gstPercent);
  assert.equal(figures.rows[0].lineTax, checkout.lines[0].tax);
  assert.equal(figures.rows[0].lineDiscount, checkout.lines[0].discount);
  assert.equal(figures.rows[0].lineTotal, checkout.lines[0].net);
  assert.equal(
    figures.rows.reduce(function (sum, row) { return sum + row.lineTotal; }, 0),
    checkout.total
  );
});

test('invoice uses the checkout HSN slab and matches the billed total', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }];
  var checkout = pricing.computeTotals(items, '');
  var billedOrder = { id: 1, items: items, total: checkout.total };
  var figures = invoice.computeInvoiceFigures(billedOrder);

  assert.equal(checkout.tax, 5);
  assert.equal(checkout.total, 105);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
  assert.doesNotMatch(invoice.render(billedOrder), /differs from Order Ledger recorded total/);
});

test('invoice uses checkout coupon and post-discount GST calculations', function () {
  var items = [{ id: 2, name: 'Rice', sku: 'RICE', hsn: '1006', price: 1000, qty: 1 }];
  var checkout = pricing.computeTotals(items, 'WELCOME');
  var billedOrder = {
    id: 2,
    items: items,
    coupon: 'WELCOME',
    subtotal: checkout.subtotal,
    discount: checkout.discount,
    tax: checkout.tax,
    total: checkout.total
  };
  var figures = invoice.computeInvoiceFigures(billedOrder);

  assert.equal(checkout.discount, 50);
  assert.equal(checkout.tax, 47.5);
  assert.equal(checkout.total, 997.5);
  assert.equal(figures.discount, checkout.discount);
  assert.equal(figures.tax, checkout.tax);
  assert.equal(figures.total, checkout.total);
});

test('invoice accepts decimal gstRate values the same way checkout does', function () {
  var items = [{ id: 3, name: 'Item', price: 100, qty: 1, gstRate: 0.05 }];
  var checkout = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({ id: 3, items: items, total: checkout.total });

  assert.equal(checkout.tax, 5);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
});
