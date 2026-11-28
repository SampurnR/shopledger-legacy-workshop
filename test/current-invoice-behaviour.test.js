'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var orders = require('../lib/orders');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function makeOrder(items, coupon) {
  var db = {
    nextOrderId: 1001,
    orders: [],
    products: [],
    customers: [],
    settlements: []
  };
  var totals = pricing.computeTotals(items, coupon || '');
  var order = orders.add(db, {
    date: '28/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
  return { db: db, totals: totals, order: order };
}

test('invoice GST and total match the order ledger for an HSN rated item', function () {
  var made = makeOrder([
    { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 1000, qty: 1 }
  ]);
  var invoiceFigures = invoice.computeInvoiceFigures(made.order);

  assert.equal(made.totals.tax, 50);
  assert.equal(made.totals.cgst, 25);
  assert.equal(made.totals.sgst, 25);
  assert.equal(made.totals.total, 1050);

  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, made.totals.tax);
  assert.equal(invoiceFigures.cgst, made.totals.cgst);
  assert.equal(invoiceFigures.sgst, made.totals.sgst);
  assert.equal(invoiceFigures.total, made.totals.total);
});

test('invoice applies the same pre-tax coupon discount and HSN GST as the order ledger', function () {
  var made = makeOrder([
    { id: 2, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 3000, qty: 1 }
  ], 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures(made.order);

  assert.equal(made.totals.discount, 150);
  assert.equal(made.totals.tax, 142.5);
  assert.equal(made.totals.total, 2992.5);

  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.discount, made.totals.discount);
  assert.equal(invoiceFigures.tax, made.totals.tax);
  assert.equal(invoiceFigures.cgst, made.totals.cgst);
  assert.equal(invoiceFigures.sgst, made.totals.sgst);
  assert.equal(invoiceFigures.total, made.totals.total);
});

test('GST reconciliation matches invoice figures to in-memory order pricing', function () {
  var made = makeOrder([
    { id: 3, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 1000, qty: 1 }
  ]);
  var reconciliation = reports.getGstReconciliation(made.db);

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].ledgerTax, 50);
  assert.equal(reconciliation.rows[0].invoiceTax, 50);
  assert.equal(reconciliation.rows[0].ledgerTotal, 1050);
  assert.equal(reconciliation.rows[0].invoiceTotal, 1050);
  assert.equal(reconciliation.rows[0].matched, true);
});
