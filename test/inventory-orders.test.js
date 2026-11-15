'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

test('sellable stock subtracts reservations and the current check rejects an exact-stock sale', function () {
  var products = [{ id: 7, name: 'Rice', stock: 10, reserved: 2 }];

  assert.equal(inventory.getSellableStock(products[0]), 8);
  assert.deepEqual(inventory.check(products, [{ id: 7, qty: 7 }]), { ok: true });
  assert.deepEqual(inventory.check(products, [{ id: 7, qty: 8 }]), {
    ok: false,
    msg: 'Rice is out of stock (8 sellable available)'
  });
});

test('cancelling a current-format order changes status but does not restore stock', function () {
  var db = {
    nextOrderId: 1001,
    products: [{ id: 7, name: 'Rice', stock: 8, reserved: 0 }],
    orders: [],
    customers: []
  };
  var order = orders.add(db, {
    items: [{ id: 7, qty: 2 }],
    subtotal: 20,
    discount: 0,
    tax: 1,
    total: 21
  });

  var result = orders.cancel(db, order.id, 'test cancellation');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  // Current order lines use `id`; release() looks up `productId` and is a no-op.
  assert.equal(db.products[0].stock, 8);
  assert.equal(db.products[0].reserved, 0);
});
