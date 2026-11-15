'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');
var inventory = require('../lib/inventory');
var ledger = require('../lib/ledger');
var orders = require('../lib/orders');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('pricing applies a coupon before the HSN GST slab and splits state tax', function () {
  var totals = pricing.computeTotals([
    { id: 'rice', name: 'Rice', hsn: '1006', price: 1000, qty: 1 }
  ], 'SAVE10');

  assert.equal(totals.subtotal, 1000);
  assert.equal(totals.discount, 100);
  assert.equal(totals.taxable, 900);
  assert.equal(totals.tax, 45);
  assert.equal(totals.cgst, 22.5);
  assert.equal(totals.sgst, 22.5);
  assert.equal(totals.total, 945);
  assert.equal(totals.lines[0].gstPercent, 5);
});

test('coupon codes are normalized; expired or below-minimum coupons give no discount', function () {
  assert.equal(coupons.calculateDiscount(500, ' save10 '), 50);
  assert.equal(coupons.calculateDiscount(499, 'SAVE10'), 0);
  assert.equal(coupons.calculateDiscount(1500, 'DIWALI20'), 0);
  assert.equal(coupons.validate('DIWALI20', 1500).valid, false);
});

test('sellable inventory excludes quote reservations and exact sellable quantity is rejected', function () {
  var products = [{ id: 'p1', name: 'Tea', stock: 10, reserved: 3 }];

  assert.equal(inventory.getSellableStock(products[0]), 7);
  assert.deepEqual(inventory.check(products, [{ id: 'p1', qty: 6 }]), { ok: true });
  assert.equal(inventory.check(products, [{ id: 'p1', qty: 7 }]).ok, false);
  assert.equal(inventory.check(products, [{ id: 'missing', qty: 1 }]).ok, false);
});

test('khata billing enforces credit limit and cancellation reverses the debit', function () {
  var db = {
    nextOrderId: 1001,
    orders: [],
    products: [{ id: 'p1', stock: 4, reserved: 2 }],
    customers: [{ id: 'c1', name: 'Asha', creditLimit: 500, openingBalance: 100, totalBilled: 0, totalSettled: 0 }]
  };

  assert.equal(ledger.chargeOrderToKhata(db, 'c1', 401).ok, false);
  assert.equal(ledger.chargeOrderToKhata(db, 'c1', 300).ok, true);
  var order = orders.add(db, {
    customer: 'Asha', customerId: 'c1', paymentMode: 'khata', total: 300,
    items: [{ productId: 'p1', qty: 1 }]
  });

  var result = orders.cancel(db, order.id, 'return');
  assert.equal(result.ok, true);
  assert.equal(db.customers[0].totalBilled, 0);
  assert.equal(db.customers[0].balance, 100);
  assert.equal(db.products[0].reserved, 1);
  assert.equal(orders.cancel(db, order.id).ok, false);
});

test('invoice uses the order HSN slab so GST and total match the amount billed', function () {
  var order = {
    id: 7,
    customer: 'Asha',
    items: [{ id: 'rice', name: 'Rice', hsn: '1006', price: 1000, qty: 1 }],
    coupon: '',
    subtotal: 1000,
    discount: 0,
    tax: 50,
    total: 1050
  };
  var ledgerFigures = pricing.computeTotals(order.items, '');
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(ledgerFigures.tax, 50);
  assert.equal(ledgerFigures.total, 1050);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, 50);
  assert.equal(invoiceFigures.total, 1050);
});

test('invoice applies the same capped coupon to taxable subtotal as order pricing', function () {
  var order = {
    id: 8,
    items: [{ id: 'tea', name: 'Tea', hsn: '0902', price: 2000, qty: 1 }],
    coupon: 'SAVE10',
    subtotal: 2000,
    discount: 150,
    tax: 333,
    total: 2183
  };
  var ledgerFigures = pricing.computeTotals(order.items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(ledgerFigures.discount, 150);
  assert.equal(ledgerFigures.tax, 333);
  assert.equal(ledgerFigures.total, 2183);
  assert.equal(invoiceFigures.discount, 150);
  assert.equal(invoiceFigures.tax, 333);
  assert.equal(invoiceFigures.total, 2183);
});

test('GST reconciliation matches the invoice figures to the order ledger', function () {
  var db = {
    orders: [{
      id: 9,
      date: '2026-11-15',
      customer: 'Asha',
      items: [{ id: 'rice', name: 'Rice', hsn: '1006', price: 1000, qty: 1 }],
      coupon: '', subtotal: 1000, discount: 0, tax: 50, total: 1050
    }]
  };
  var reconciliation = reports.getGstReconciliation(db);

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.deepEqual(reconciliation.rows[0], {
    orderId: 9,
    date: '2026-11-15',
    customer: 'Asha',
    coupon: '',
    ledgerSubtotal: 1000,
    ledgerDiscount: 0,
    ledgerTax: 50,
    ledgerTotal: 1050,
    invoiceDiscount: 0,
    invoiceTax: 50,
    invoiceTotal: 1050,
    delta: 0,
    matched: true
  });
  assert.equal(reconciliation.totalDelta, 0);
});
