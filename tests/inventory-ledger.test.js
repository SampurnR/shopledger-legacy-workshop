var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var ledger = require('../lib/ledger');
var orders = require('../lib/orders');
var dates = require('../lib/dates');
var helpers = require('./helpers');

test('current behavior: sellable stock excludes reservations and never reports below zero', function () {
  assert.equal(inventory.getSellableStock({ stock: 18, reserved: 2 }), 16);
  assert.equal(inventory.getSellableStock({ stock: 1, reserved: 3 }), 0);
});

test('known behavior requiring a business decision: exact available quantity is rejected', function () {
  var products = [{ id: 1, name: 'Test', stock: 2, reserved: 1 }];
  assert.equal(inventory.check(products, [{ id: 1, qty: 1 }]).ok, false);
});

test('known defect: duplicate product lines pass individually and produce negative stock', function () {
  var products = [{ id: 1, name: 'Test', stock: 10, reserved: 0 }];
  var items = [{ id: 1, qty: 6 }, { id: 1, qty: 6 }];
  assert.equal(inventory.check(products, items).ok, true);
  inventory.reserve(products, items);
  assert.equal(products[0].stock, -2);
});

test('CURRENT BEHAVIOUR: numeric settlements reduce the computed balance', function (t) {
  t.mock.method(dates, 'today', function () { return '15/04/2022'; });
  var db = helpers.createDb();
  var result = ledger.recordSettlement(db, 1, 50, 'cash', 'test payment');
  assert.equal(result.ok, true);
  assert.equal(db.customers[0].totalSettled, 150);
  assert.equal(db.customers[0].balance, 400);
  assert.deepEqual([result.settlement.id, result.settlement.amount, result.settlement.date],
    [501, 50, '15/04/2022']);
});

test('REGRESSION: string settlements update running totals and receipts numerically', function () {
  var db = helpers.createDb();
  var result = ledger.recordSettlement(db, 1, '50', 'upi');
  assert.equal(result.ok, true);
  assert.equal(db.customers[0].totalSettled, 150);
  assert.equal(db.customers[0].balance, 400);
  assert.equal(result.settlement.amount, 50);
});

test('current behavior: credit-limit rejection and invalid settlements leave totals unchanged', function () {
  var db = helpers.createDb();
  var before = helpers.clone(db);
  assert.equal(ledger.chargeOrderToKhata(db, 1, 4551).ok, false);
  assert.equal(ledger.recordSettlement(db, 1, 0).ok, false);
  assert.equal(ledger.recordSettlement(db, 1, -1).ok, false);
  assert.equal(ledger.recordSettlement(db, 999, 10).ok, false);
  assert.deepEqual(db, before);
  assert.equal(ledger.chargeOrderToKhata(db, 1, 4550).ok, true);
  assert.equal(db.customers[0].balance, 5000);
});

test('known defect: cancellation reverses Khata but leaves deducted stock unchanged', function (t) {
  t.mock.method(dates, 'today', function () { return '15/04/2022'; });
  var db = helpers.createDb();
  db.products[0].stock = 17;
  db.orders.push({ id: 1001, status: 'completed', paymentMode: 'khata', customerId: 1,
    total: 100, items: [{ id: 1, qty: 1 }] });
  assert.equal(orders.cancel(db, 1001, 'test cancellation').ok, true);
  assert.deepEqual([db.products[0].stock, db.products[0].reserved], [17, 2]);
  assert.deepEqual([db.customers[0].totalBilled, db.customers[0].balance], [400, 350]);
  assert.equal(db.orders[0].status, 'cancelled');
  var after = helpers.clone(db);
  assert.equal(orders.cancel(db, 1001).ok, false);
  assert.deepEqual(db, after);
});
