'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

test('inventory check allows buying exactly the sellable stock', function () {
  var products = [{ id: 1, name: 'Widget', stock: 1, reserved: 0 }];

  var result = inventory.check(products, [{ id: 1, qty: 1 }]);

  assert.deepEqual(result, { ok: true });
});

test('inventory check allows buying fewer than the sellable stock', function () {
  var products = [{ id: 1, name: 'Widget', stock: 2, reserved: 0 }];

  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 1 }]), { ok: true });
});

test('cancelling an order restores its committed units to physical stock', function () {
  var db = {
    products: [{ id: 1, name: 'Widget', stock: 6, reserved: 1 }],
    orders: [{
      id: 27,
      status: 'completed',
      paymentMode: 'cash',
      items: [{ id: 1, name: 'Widget', qty: 2 }]
    }]
  };

  inventory.reserve(db.products, db.orders[0].items);
  assert.equal(db.products[0].stock, 4);

  var result = orders.cancel(db, 27, 'Test cancellation');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(db.products[0].stock, 6);
  assert.equal(db.products[0].reserved, 1);
});
