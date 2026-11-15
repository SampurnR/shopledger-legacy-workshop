'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');

test('sellable stock subtracts wholesale reservations and reserve deducts physical stock', function () {
  var products = [{ id: 1, name: 'Rice', stock: 8, reserved: 3 }];
  var items = [{ id: 1, qty: 2 }];

  assert.equal(inventory.getSellableStock(products[0]), 5);
  assert.deepEqual(inventory.check(products, items), { ok: true });
  inventory.reserve(products, items);
  assert.equal(products[0].stock, 6);
  assert.equal(inventory.getSellableStock(products[0]), 3);
});

test('current stock check rejects a quantity equal to sellable stock', function () {
  var products = [{ id: 1, name: 'Rice', stock: 3, reserved: 0 }];

  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 3 }]), {
    ok: false,
    msg: 'Rice is out of stock (3 sellable available)'
  });
});
