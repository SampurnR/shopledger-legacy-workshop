var test = require('node:test');
var assert = require('node:assert/strict');

var coupons = require('../lib/coupons');
var inventory = require('../lib/inventory');
var invoice = require('../lib/invoice');
var ledger = require('../lib/ledger');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');

test('HSN 1006 items use 5% GST and split tax into CGST and SGST', function () {
  var totals = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }
  ], '');

  assert.equal(tax.getSlabPercent({ hsn: '1006' }), 5);
  assert.equal(totals.subtotal, 200);
  assert.equal(totals.tax, 10);
  assert.equal(totals.cgst, 5);
  assert.equal(totals.sgst, 5);
  assert.equal(totals.total, 210);
});

test('coupon codes are normalized and percentage discounts honor their cap', function () {
  assert.equal(coupons.normalizeCode(' save10 '), 'SAVE10');
  var result = coupons.validate('save10', 2000);

  assert.equal(result.valid, true);
  assert.equal(result.discount, 150);
});

test('coupon discount is apportioned before item GST is calculated', function () {
  var totals = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 200, qty: 1 }
  ], 'WELCOME');

  assert.equal(totals.subtotal, 200);
  assert.equal(totals.discount, 10);
  assert.equal(totals.tax, 9.5);
  assert.equal(totals.total, 199.5);
});

test('inventory sellable quantity excludes reserved units', function () {
  var product = { id: 1, stock: 10, reserved: 2 };

  assert.equal(inventory.getSellableStock(product), 8);
  assert.equal(inventory.check([product], [{ id: 1, qty: 7 }]).ok, true);
});

test('CURRENT BEHAVIOUR: stock check rejects an order equal to sellable stock', function () {
  var product = { id: 1, name: 'Rice', stock: 8, reserved: 0 };

  assert.deepEqual(inventory.check([product], [{ id: 1, qty: 8 }]), {
    ok: false,
    msg: 'Rice is out of stock (8 sellable available)'
  });
});

test('khata order charges update the customer balance', function () {
  var db = {
    customers: [{ id: 7, name: 'Asha', creditLimit: 500, openingBalance: 20, totalBilled: 100, totalSettled: 30 }]
  };

  var result = ledger.chargeOrderToKhata(db, 7, 50);

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalBilled, 150);
  assert.equal(result.customer.balance, 140);
});

test('invoice calculation matches HSN-aware order pricing', function () {
  var order = {
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: 'WELCOME',
    total: 99.75
  };
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceFigures.tax, 4.75);
  assert.equal(invoiceFigures.discount, 5);
  assert.equal(invoiceFigures.total, order.total);
});

test('CURRENT BEHAVIOUR: cancelling does not restore stock deducted from an order', function () {
  var product = { id: 1, stock: 8, reserved: 0 };
  var db = {
    products: [product],
    orders: [{ id: 1001, status: 'completed', paymentMode: 'cash', items: [{ id: 1, qty: 2 }], total: 20 }]
  };

  var result = orders.cancel(db, 1001, 'test');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(product.stock, 8);
  assert.equal(product.reserved, 0);
});
