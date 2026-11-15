var assert = require('node:assert/strict');
var test = require('node:test');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

function fixture(stock, reserved) {
  return {
    products: [
      { id: 1, name: 'Rice', stock: stock, reserved: reserved },
      { id: 2, name: 'Tea', stock: 7, reserved: 1 }
    ],
    orders: [],
    nextOrderId: 1001,
    customers: []
  };
}

function purchase(db, items, status) {
  assert.equal(inventory.check(db.products, items).ok, true);
  inventory.reserve(db.products, items);
  return orders.add(db, { items: items, status: status, total: 100 });
}

test('purchases the last physical unit', function () {
  var db = fixture(1, 0);
  purchase(db, [{ id: 1, qty: 1 }]);
  assert.equal(db.products[0].stock, 0);
  assert.equal(inventory.getSellableStock(db.products[0]), 0);
});

test('purchases exact sellable stock while preserving wholesale holds', function () {
  var db = fixture(5, 2);
  purchase(db, [{ id: 1, qty: 3 }]);
  assert.equal(db.products[0].stock, 2);
  assert.equal(db.products[0].reserved, 2);
  assert.equal(inventory.getSellableStock(db.products[0]), 0);
});

test('rejects insufficient and fully reserved stock without mutation', function () {
  [fixture(5, 2), fixture(2, 2), fixture(0, 0)].forEach(function (db) {
    var before = JSON.stringify(db);
    var result = inventory.check(db.products, [{ id: 1, qty: 4 }]);
    assert.equal(result.ok, false);
    assert.match(result.msg, /out of stock/);
    assert.equal(JSON.stringify(db), before);
  });
});

test('rejects duplicate lines whose combined quantity exceeds sellable stock', function () {
  var db = fixture(5, 2);
  var before = JSON.stringify(db);
  var result = inventory.check(db.products, [{ id: 1, qty: 2 }, { id: '1', qty: 2 }]);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(db), before);
});

test('accepts duplicate lines totaling exact stock and restores both on cancellation', function () {
  var db = fixture(5, 2);
  var before = JSON.stringify(db.products);
  var order = purchase(db, [{ id: 1, qty: 1 }, { id: '1', qty: 2 }]);
  assert.equal(db.products[0].stock, 2);
  assert.equal(orders.cancel(db, order.id, 'Return').ok, true);
  assert.equal(JSON.stringify(db.products), before);
});

['completed', 'pending'].forEach(function (status) {
  test('cancels a ' + status + ' order and restores every product exactly once', function () {
    var db = fixture(8, 2);
    var before = JSON.stringify(db.products);
    var order = purchase(db, [{ id: 1, qty: 3 }, { id: 2, qty: 2 }], status);
    var result = orders.cancel(db, order.id, 'Customer request');
    assert.equal(result.ok, true);
    assert.equal(order.status, 'cancelled');
    assert.equal(order.cancelReason, 'Customer request');
    assert.equal(JSON.stringify(db.products), before);
    var cancelled = JSON.stringify(db);
    assert.equal(orders.cancel(db, order.id, 'Again').ok, false);
    assert.equal(JSON.stringify(db), cancelled);
  });
});

test('unknown products and orders are rejected without mutation', function () {
  var db = fixture(5, 2);
  var before = JSON.stringify(db);
  assert.equal(inventory.check(db.products, [{ id: 999, qty: 1 }]).ok, false);
  assert.equal(orders.cancel(db, 999, 'Missing').ok, false);
  assert.equal(JSON.stringify(db), before);
});

test('Khata cancellation restores inventory and reverses the debit once', function () {
  var db = fixture(5, 2);
  db.customers.push({ id: 1, openingBalance: 50, totalBilled: 100, totalSettled: 20, balance: 130 });
  var order = purchase(db, [{ id: 1, qty: 2 }]);
  order.customerId = 1;
  order.paymentMode = 'khata';
  assert.equal(orders.cancel(db, order.id, 'Return').ok, true);
  assert.equal(db.products[0].stock, 5);
  assert.equal(db.products[0].reserved, 2);
  assert.equal(db.customers[0].totalBilled, 0);
  assert.equal(db.customers[0].balance, 30);
  var before = JSON.stringify(db);
  assert.equal(orders.cancel(db, order.id, 'Again').ok, false);
  assert.equal(JSON.stringify(db), before);
});
