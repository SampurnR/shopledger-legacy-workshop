'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function checkoutOrder(overrides) {
  var items = [{
    id: 1,
    sku: 'RICE-1',
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 1
  }];
  var totals = pricing.computeTotals(items, '');
  var order = {
    id: 42,
    date: '2026-11-26',
    customer: 'Test Customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
  Object.keys(overrides || {}).forEach(function (key) {
    order[key] = overrides[key];
  });
  return order;
}

test('invoice uses the checkout HSN slab and matches the ledger total', function () {
  var order = checkoutOrder();
  var checkout = pricing.computeTotals(order.items, order.coupon);
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ tax: checkout.tax, total: checkout.total }, { tax: 5, total: 105 });
  assert.deepEqual({ tax: figures.tax, total: figures.total }, { tax: 5, total: 105 });
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice coupon discount is calculated on the checkout basis', function () {
  var items = [{ id: 2, name: 'Unclassified item', price: 100, qty: 1 }];
  var checkout = pricing.computeTotals(items, 'WELCOME');
  var order = checkoutOrder({
    items: items,
    coupon: 'WELCOME',
    subtotal: checkout.subtotal,
    discount: checkout.discount,
    tax: checkout.tax,
    total: checkout.total
  });
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ discount: checkout.discount, tax: checkout.tax, total: checkout.total }, {
    discount: 5, tax: 17.1, total: 112.1
  });
  assert.deepEqual({ discount: figures.discount, tax: figures.tax, total: figures.total }, {
    discount: 5, tax: 17.1, total: 112.1
  });
});

test('invoice interprets a decimal gstRate the same way as checkout', function () {
  var items = [{ id: 3, name: 'Tea', hsn: '0902', price: 100, qty: 1, gstRate: 0.05 }];
  var checkout = pricing.computeTotals(items, '');
  var order = checkoutOrder({
    items: items,
    subtotal: checkout.subtotal,
    discount: checkout.discount,
    tax: checkout.tax,
    total: checkout.total
  });
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(checkout.tax, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('GST reconciliation matches completed checkout figures and ignores cancelled orders', function () {
  var active = checkoutOrder();
  var cancelled = checkoutOrder({ id: 43, status: 'cancelled' });
  var result = reports.getGstReconciliation({ orders: [active, cancelled] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].matched, true);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[0].invoiceTotal, 105);
});
