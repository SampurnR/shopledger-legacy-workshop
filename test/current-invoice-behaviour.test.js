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

test('historical invoice keeps recorded billed totals and flags differences from current pricing', function () {
  var order = {
    id: 1002,
    subtotal: 100,
    discount: 0,
    tax: 6,
    total: 106,
    items: [
      { id: 4, name: 'Historical rice', hsn: '1006', price: 100, qty: 1 }
    ]
  };
  var invoiceFigures = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);
  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.deepEqual([
    invoiceFigures.subtotal,
    invoiceFigures.discount,
    invoiceFigures.tax,
    invoiceFigures.cgst,
    invoiceFigures.sgst,
    invoiceFigures.total
  ], [100, 0, 6, 3, 3, 106]);
  assert.deepEqual([invoiceFigures.rows[0].gstPercent, invoiceFigures.rows[0].lineTax], [5, 5]);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">[^<]*6\.00<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*106\.00<\/td>/);
  assert.match(html, /Recalculated total \(₹105\.00\) differs from recorded total \(₹106\.00\)/);
  assert.match(html, /Recalculated line GST adds up to ₹5\.00, while recorded GST is ₹6\.00/);

  assert.equal(reconciliation.mismatchCount, 1);
  assert.equal(reconciliation.totalDelta, 1);
  assert.deepEqual([
    reconciliation.rows[0].ledgerTax,
    reconciliation.rows[0].invoiceTax,
    reconciliation.rows[0].ledgerTotal,
    reconciliation.rows[0].invoiceTotal,
    reconciliation.rows[0].matched
  ], [6, 5, 106, 105, false]);
});

test('historical invoice keeps recorded subtotal and discount when current pricing differs', function () {
  var order = {
    id: 1003,
    subtotal: 100,
    discount: 10,
    tax: 4.5,
    total: 94.5,
    coupon: 'SAVE10',
    items: [
      { id: 5, name: 'Historical rice', hsn: '1006', price: 100, qty: 1 }
    ]
  };
  var invoiceFigures = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);

  assert.deepEqual([
    invoiceFigures.subtotal,
    invoiceFigures.discount,
    invoiceFigures.tax,
    invoiceFigures.total
  ], [100, 10, 4.5, 94.5]);
  assert.match(html, /Gross Subtotal<\/td><td class="r">[^<]*100\.00<\/td>/);
  assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td class="r"[^>]*>-₹10\.00<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*94\.50<\/td>/);
  assert.match(html, /Recalculated subtotal and discount are ₹100\.00 and ₹0\.00, while recorded amounts are ₹100\.00 and ₹10\.00/);
});
