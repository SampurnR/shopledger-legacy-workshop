'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function order(items, coupon) {
  return { id: 1002, date: '2022-01-10', items: items, coupon: coupon || '' };
}

test('CURRENT BEHAVIOUR: invoice uses HSN rates and prorates SAVE10 like checkout for order 1002', function () {
  var result = invoice.computeInvoiceFigures(order([
    { name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
  ], 'SAVE10'));
  assert.deepEqual(
    { subtotal: result.subtotal, discount: result.discount, tax: result.tax, total: result.total },
    { subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 }
  );
  assert.deepEqual(result.rows.map(function (row) { return row.gstPercent; }), [5, 5]);
  assert.deepEqual(result.rows.map(function (row) { return row.taxable; }), [576, 342]);
});

test('CURRENT BEHAVIOUR: SAVE10 discount cap and 5% HSN rate match checkout for order 1004', function () {
  var result = invoice.computeInvoiceFigures(order([
    { name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 }
  ], 'SAVE10'));
  assert.deepEqual(
    { subtotal: result.subtotal, discount: result.discount, tax: result.tax, total: result.total },
    { subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 }
  );
  assert.equal(result.rows[0].gstPercent, 5);
});

test('CURRENT BEHAVIOUR: mixed HSN slabs reconcile for order 1007', function () {
  var result = invoice.computeInvoiceFigures(order([
    { name: 'Ghee', hsn: '0405', price: 450, qty: 2 },
    { name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
  ]));
  assert.deepEqual(result.rows.map(function (row) { return row.gstPercent; }), [12, 5]);
  assert.equal(result.tax, 127);
  assert.equal(result.total, 1407);
});

test('CURRENT BEHAVIOUR: non-coupon 18% and 5% HSN items retain their individual rates for order 1001', function () {
  var result = invoice.computeInvoiceFigures(order([
    { name: 'Tea', hsn: '0902', price: 140, qty: 2 },
    { name: 'Toor dal', hsn: '0713', price: 165, qty: 2 }
  ]));
  assert.deepEqual(result.rows.map(function (row) { return row.gstPercent; }), [18, 5]);
  assert.equal(result.tax, 66.9);
  assert.equal(result.total, 676.9);
});

test('CURRENT BEHAVIOUR: all-18% non-coupon invoice remains unchanged for order 1008', function () {
  var result = invoice.computeInvoiceFigures(order([
    { name: 'Tea', hsn: '0902', price: 140, qty: 1 },
    { name: 'Kokum', hsn: '2106', price: 180, qty: 2 }
  ]));
  assert.deepEqual(
    { subtotal: result.subtotal, discount: result.discount, tax: result.tax, total: result.total },
    { subtotal: 500, discount: 0, tax: 90, total: 590 }
  );
});

test('CURRENT BEHAVIOUR: reconciliation matches an in-memory checkout ledger order', function () {
  var items = [
    { name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
  ];
  var db = { orders: [
    { id: 1002, date: '2022-01-05', items: items, coupon: 'SAVE10', subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 }
  ] };
  var result = reports.getGstReconciliation(db);
  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].orderId, 1002);
});

test('CURRENT BEHAVIOUR: invoice HTML escapes customer supplied text', function () {
  var html = invoice.render({ id: 3, customer: '<script>alert(1)</script>', items: [] });
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.ok(html.includes('&lt;script&gt;'));
});
