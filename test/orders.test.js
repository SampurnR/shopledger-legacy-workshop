var assert = require('node:assert/strict');
var test = require('node:test');

var orders = require('../lib/orders');
var inventory = require('../lib/inventory');

function makeDb() {
  return {
    products: [
      { id: 1, name: 'Rice', stock: 7, reserved: 2 }
    ],
    orders: [
      {
        id: 1001,
        status: 'completed',
        paymentMode: 'cash',
        items: [{ id: 1, name: 'Rice', qty: 3 }],
        total: 315
      }
    ]
  };
}

test('cancelling an order restores its items to physical stock', function () {
  var db = makeDb();

  var result = orders.cancel(db, 1001, 'Customer request');

  assert.equal(result.ok, true);
  assert.equal(db.products[0].stock, 10);
  assert.equal(db.products[0].reserved, 2);
  assert.equal(result.order.status, 'cancelled');
});

test('an already-cancelled order cannot restore stock twice', function () {
  var db = makeDb();

  assert.equal(orders.cancel(db, 1001).ok, true);
  var secondResult = orders.cancel(db, 1001);

  assert.equal(secondResult.ok, false);
  assert.equal(db.products[0].stock, 10);
});

test('an order can use the exact remaining sellable stock', function () {
  var products = [{ id: 1, name: 'Rice', stock: 4, reserved: 3 }];

  var result = inventory.check(products, [{ id: 1, qty: 1 }]);

  assert.equal(result.ok, true);
});

test('an order cannot exceed the remaining sellable stock', function () {
  var products = [{ id: 1, name: 'Rice', stock: 4, reserved: 3 }];

  var result = inventory.check(products, [{ id: 1, qty: 2 }]);

  assert.equal(result.ok, false);
  assert.match(result.msg, /1 sellable available/);
});
