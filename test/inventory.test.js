var test = require('node:test');
var assert = require('node:assert/strict');

var inventory = require('../lib/inventory');

test('CURRENT BEHAVIOUR: quote release reduces reserved units without changing physical stock', function () {
  var products = [{ id: 1, name: 'Rice', stock: 10, reserved: 4 }];

  inventory.release(products, [{ productId: 1, qty: 3 }]);

  assert.deepEqual(products, [{ id: 1, name: 'Rice', stock: 10, reserved: 1 }]);
});

test('an order can consume exactly the available sellable stock', function () {
  var products = [{ id: 1, name: 'Rice', stock: 10, reserved: 4 }];

  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 6 }]), { ok: true });
});
