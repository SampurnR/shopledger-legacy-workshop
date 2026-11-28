'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

function makeDb(status) {
  return {
    products: [
      { id: 6, stock: 10, reserved: 0 },
      { id: 4, stock: 20, reserved: 3 }
    ],
    orders: [{
      id: 1007,
      status: status,
      paymentMode: 'cash',
      total: 1407,
      items: [
        { id: 6, qty: 2 },
        { id: 4, qty: 2 }
      ]
    }]
  };
}

test('selling Qty 1 with exactly 1 sellable unit is allowed', function () {
  var products = [
    { id: 1, name: 'Test item', stock: 1, reserved: 0 }
  ];
  var items = [{ id: 1, qty: 1 }];

  assert.deepEqual(inventory.check(products, items), { ok: true });
  inventory.reserve(products, items);
  assert.equal(products[0].stock, 0);
});

test('pending order cancellation restores deducted stock and preserves quote reservations', function () {
  var db = makeDb('pending');

  var result = orders.cancel(db, 1007, 'Characterization test');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(db.products[0].stock, 12);
  assert.equal(db.products[1].stock, 22);
  assert.equal(db.products[0].reserved, 0);
  assert.equal(db.products[1].reserved, 3);
});

test('repeated pending order cancellation does not restore stock again', function () {
  var db = makeDb('pending');

  assert.equal(orders.cancel(db, 1007, 'First cancellation').ok, true);
  var stockAfterFirstCancellation = db.products.map(function (product) { return product.stock; });
  var repeated = orders.cancel(db, 1007, 'Repeated cancellation');

  assert.equal(repeated.ok, false);
  assert.deepEqual(db.products.map(function (product) { return product.stock; }), stockAfterFirstCancellation);
});

test('cancelling a completed order does not restore stock', function () {
  var db = makeDb('completed');

  var result = orders.cancel(db, 1007, 'Completed order cancellation');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(db.products[0].stock, 10);
  assert.equal(db.products[1].stock, 20);
  assert.equal(db.products[0].reserved, 0);
  assert.equal(db.products[1].reserved, 3);
});
