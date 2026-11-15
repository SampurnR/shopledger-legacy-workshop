'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice figures match the customer-billed pricing for HSN items with a coupon', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 4, name: 'Oil', hsn: '1512', price: 190, qty: 2 }
  ];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(invoiceFigures.subtotal, billed.subtotal);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
  assert.deepEqual(
    invoiceFigures.rows.map(function (row) { return row.lineTax; }),
    billed.lines.map(function (line) { return line.tax; })
  );
});

test('invoice uses the customer-billed HSN GST slab', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice coupon discount and GST match customer-billed pricing', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', gstRate: 5, price: 2000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 92.5);
  assert.equal(billed.total, 1942.5);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice render has no mismatch notice when figures match the stored billed total', function () {
  var order = {
    id: 42,
    date: '15/03/2022',
    customer: 'Walk-in',
    paymentMode: 'cash',
    status: 'completed',
    coupon: '',
    total: 105,
    items: [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 100, qty: 1 }]
  };

  var html = invoice.render(order);

  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
