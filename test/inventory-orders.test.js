'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');

var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

test('stock check allows a request for the last sellable unit', function () {
  var products = [{ id: 1, name: 'Rice', stock: 1, reserved: 0 }];

  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 1 }]), { ok: true });
});

test('stock check accepts a quantity below sellable stock', function () {
  var products = [{ id: 1, name: 'Rice', stock: 2, reserved: 0 }];

  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 1 }]), { ok: true });
});

test('stock check rejects a request above sellable stock', function () {
  var products = [{ id: 1, name: 'Rice', stock: 1, reserved: 0 }];

  assert.equal(inventory.check(products, [{ id: 1, qty: 2 }]).ok, false);
});

test('cancelling an order with id-based items restores physical stock', function () {
  var product = { id: 1, name: 'Rice', stock: 4, reserved: 0 };
  var order = {
    id: 42,
    status: 'completed',
    paymentMode: 'cash',
    items: [{ id: 1, qty: 2 }]
  };
  var db = { products: [product], orders: [order] };

  var result = orders.cancel(db, 42, 'Characterization');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(product.stock, 6);
  assert.equal(product.reserved, 0);
});

test('CURRENT BEHAVIOUR: release with productId reduces reserved units without changing physical stock', function () {
  var product = { id: 1, name: 'Rice', stock: 4, reserved: 2 };

  inventory.release([product], [{ productId: 1, qty: 1 }]);

  assert.equal(product.stock, 4);
  assert.equal(product.reserved, 1);
});
