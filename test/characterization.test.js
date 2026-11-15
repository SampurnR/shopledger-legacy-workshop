var assert = require('node:assert/strict');
var test = require('node:test');
var coupons = require('../lib/coupons');
var dates = require('../lib/dates');
var inventory = require('../lib/inventory');
var invoice = require('../lib/invoice');
var ledger = require('../lib/ledger');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');
var tax = require('../lib/tax');

test('coupons normalize codes, enforce minimums and expiration, and cap percentage discounts', function () {
  assert.equal(coupons.validate(' save10 ', 500).code, 'SAVE10');
  assert.equal(coupons.calculateDiscount(500, 'SAVE10'), 50);
  assert.equal(coupons.calculateDiscount(2000, 'SAVE10'), 150);
  assert.equal(coupons.validate('SAVE10', 499.99).valid, false);
  assert.equal(coupons.validate('DIWALI20', 2000).error, 'Coupon DIWALI20 has expired');
});

test('pricing applies the allocated discount before each line’s GST', function () {
  var totals = pricing.computeTotals([
    { price: 100, qty: 2, hsn: '1006' },
    { price: 300, qty: 1, hsn: '0405' }
  ], 'SAVE10');

  assert.deepEqual(totals.lines.map(function (line) {
    return [line.discount, line.taxable, line.gstPercent, line.tax];
  }), [[20, 180, 5, 9], [30, 270, 12, 32.4]]);
  assert.equal(totals.total, 491.4);
  assert.deepEqual(tax.splitCgstSgst(0.05), { cgst: 0.03, sgst: 0.02 });
});

test('CURRENT BEHAVIOUR: rounded line discounts can differ from the order discount', function () {
  var totals = pricing.computeTotals([
    { price: 0.05, qty: 1 },
    { price: 0.05, qty: 1 }
  ], 'WELCOME');

  assert.equal(totals.discount, 0.01);
  assert.deepEqual(totals.lines.map(function (line) {
    return line.discount;
  }), [0.01, 0.01]);
});

test('invoice and GST reconciliation agree with billing for a discounted HSN order', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }];
  var totals = pricing.computeTotals(items, 'SAVE10');
  var order = Object.assign({}, totals, { id: 1, items: items, coupon: 'SAVE10' });
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(totals.total, 1942.5);
  assert.equal(figures.tax, 92.5);
  assert.equal(figures.discount, 150);
  assert.equal(figures.total, 1942.5);

  var reconciliation = reports.getGstReconciliation({
    orders: [order, Object.assign({}, order, { id: 2, status: 'cancelled' })]
  });
  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});

test('CURRENT BEHAVIOUR: stock check rejects an exact fit but accepts duplicate lines individually', function () {
  var products = [{ id: 1, name: 'Rice', stock: 10, reserved: 2 }];
  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 8 }]), {
    ok: false,
    msg: 'Rice is out of stock (8 sellable available)'
  });

  var items = [{ id: 1, qty: 7 }, { id: '1', qty: 7 }];
  assert.deepEqual(inventory.check(products, items), { ok: true });
  inventory.reserve(products, items);
  assert.equal(products[0].stock, -4);
  assert.equal(inventory.getSellableStock(products[0]), 0);
});

test('CURRENT BEHAVIOUR: cancellation reverses khata but leaves physical stock deducted', function () {
  var product = { id: 1, stock: 10, reserved: 3 };
  var customer = { id: 1, creditLimit: 500, openingBalance: 20 };
  var db = { products: [product], customers: [customer], orders: [], nextOrderId: 1 };
  var items = [{ id: 1, qty: 2 }];

  assert.equal(ledger.chargeOrderToKhata(db, 1, 100).ok, true);
  assert.equal(customer.balance, 120);
  inventory.reserve(db.products, items);
  var order = orders.add(db, {
    date: '01/04/2026', items: items, customerId: 1, paymentMode: 'khata', total: 100
  });

  assert.equal(orders.cancel(db, String(order.id), 'Returned').ok, true);
  assert.equal(order.status, 'cancelled');
  assert.equal(order.cancelReason, 'Returned');
  assert.equal(customer.balance, 20);
  assert.equal(product.stock, 8);
  assert.equal(product.reserved, 3);
  assert.equal(orders.cancel(db, order.id).ok, false);
});

test('khata permits reaching the credit limit and rejects charges above it', function () {
  var customer = { id: 1, name: 'Customer', creditLimit: 100, openingBalance: 25 };
  var db = { customers: [customer] };

  assert.equal(ledger.chargeOrderToKhata(db, '1', 75).ok, true);
  assert.equal(ledger.chargeOrderToKhata(db, 1, 0.01).ok, false);
  assert.equal(customer.totalBilled, 75);
  assert.equal(customer.balance, 100);
});

test('CURRENT BEHAVIOUR: settlement on a legacy account without totalSettled produces NaN', function () {
  var customer = { id: 1, name: 'Customer', totalBilled: 100 };
  var db = { customers: [customer], nextSettlementId: 1 };

  var result = ledger.recordSettlement(db, 1, 25);
  assert.equal(result.ok, true);
  assert.equal(result.settlement.amount, 25);
  assert.equal(result.settlement.mode, 'upi');
  assert.equal(Number.isNaN(customer.totalSettled), true);
  assert.equal(Number.isNaN(customer.balance), true);
});

test('fiscal year rolls over on April 1 and accepts ISO dates', function () {
  assert.equal(dates.getFiscalYear('31/03/2026'), 'FY25-26');
  assert.equal(dates.getFiscalYear('2026-04-01'), 'FY26-27');
});

test('CURRENT BEHAVIOUR: order date filters and sorting compare day-first text', function () {
  var db = { orders: [
    { id: 1, date: '31/03/2026' },
    { id: 2, date: '01/04/2026' },
    { id: 3, date: '15/04/2026' }
  ] };

  assert.deepEqual(orders.list(db).map(function (order) {
    return order.id;
  }), [1, 3, 2]);
  assert.deepEqual(orders.list(db, { from: '2026-04-01', to: '2026-04-30' }).map(function (order) {
    return order.id;
  }), [3, 2]);
  assert.deepEqual(orders.list(db, { from: '2026-03-31', to: '2026-04-01' }), []);
});
