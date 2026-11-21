var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice matches checkout HSN GST and coupon totals', function () {
  var order = {
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }],
    coupon: 'WELCOME'
  };
  var checkout = pricing.computeTotals(order.items, order.coupon);
  var invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(invoiced.tax, checkout.tax);
  assert.equal(invoiced.discount, checkout.discount);
  assert.equal(invoiced.total, checkout.total);
  assert.equal(invoiced.rows[0].gstPercent, 5);
});

test('CURRENT BEHAVIOUR: invoice uses the same HSN GST rate as checkout', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var checkout = pricing.computeTotals(items, '');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(checkout.tax, 5);
  assert.equal(checkout.total, 105);
  assert.equal(invoiced.tax, checkout.tax);
  assert.equal(invoiced.total, checkout.total);
  assert.equal(invoiced.rows[0].gstPercent, 5);
});

test('CURRENT BEHAVIOUR: invoice applies coupon to taxable value before GST', function () {
  var items = [{ id: 1, name: 'Goods', hsn: '1006', price: 1000, qty: 1 }];
  var checkout = pricing.computeTotals(items, 'WELCOME');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.equal(checkout.discount, 50);
  assert.equal(checkout.tax, 47.5);
  assert.equal(checkout.total, 997.5);
  assert.equal(invoiced.discount, checkout.discount);
  assert.equal(invoiced.tax, checkout.tax);
  assert.equal(invoiced.total, checkout.total);
});

test('CURRENT BEHAVIOUR: invoice resolves explicit gstRate with checkout semantics', function () {
  var order = {
    items: [
      { name: 'Percent rate', price: 100, qty: 1, gstRate: 5 },
      { name: 'Decimal rate', price: 100, qty: 1, gstRate: 0.05 }
    ],
    coupon: ''
  };
  var invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(invoiced.tax, 10);
  assert.deepEqual(invoiced.rows.map(function (row) { return row.gstPercent; }), [5, 5]);
});

test('CURRENT BEHAVIOUR: reconciliation matches stored checkout figures', function () {
  var order = {
    id: 7,
    date: '2026-01-02',
    customer: 'In-memory customer',
    coupon: 'WELCOME',
    items: [{ name: 'Rice', hsn: '1006', price: 1000, qty: 1 }],
    subtotal: 1000,
    discount: 50,
    tax: 47.5,
    total: 997.5
  };
  var result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 7,
    date: '2026-01-02',
    customer: 'In-memory customer',
    coupon: 'WELCOME',
    ledgerSubtotal: 1000,
    ledgerDiscount: 50,
    ledgerTax: 47.5,
    ledgerTotal: 997.5,
    invoiceDiscount: 50,
    invoiceTax: 47.5,
    invoiceTotal: 997.5,
    delta: 0,
    matched: true
  });
});

test('CURRENT BEHAVIOUR: invoice render omits mismatch notice for matching checkout total', function () {
  var html = invoice.render({
    id: 8,
    customer: 'In-memory customer',
    total: 105,
    coupon: '',
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  });

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice Total/);
});
