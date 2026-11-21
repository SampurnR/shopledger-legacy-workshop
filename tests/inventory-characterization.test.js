'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

test('allows selling the last sellable unit for both stock scenarios', function () {
  var products = [
    { id: 6, name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 },
    { id: 11, name: 'Byadgi Kashmiri Chilli Powder 500g', stock: 4, reserved: 3 }
  ];

  assert.deepEqual(inventory.check(products, [{ id: 6, qty: 1 }]), { ok: true });
  assert.deepEqual(inventory.check(products, [{ id: 11, qty: 1 }]), { ok: true });
});

test('allows the exact sellable quantity and still rejects quantities above stock', function () {
  var products = [{ id: 1, name: 'Rice', stock: 5, reserved: 1 }];

  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 4 }]), { ok: true });
  assert.equal(inventory.check(products, [{ id: 1, qty: 5 }]).ok, false);
});

test('cancelling an order restores physical stock for id-based order lines', function () {
  var db = {
    products: [
      { id: 6, name: 'A2 Gir Cow Ghee 500ml', stock: 3, reserved: 0 },
      { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', stock: 8, reserved: 0 }
    ],
    orders: [{
      id: 1007,
      status: 'pending',
      paymentMode: 'cash',
      items: [{ id: 6, qty: 2 }, { id: 4, qty: 2 }]
    }]
  };

  var result = orders.cancel(db, 1007, 'Cancelled from test');

  assert.equal(result.ok, true);
  assert.equal(db.orders[0].status, 'cancelled');
  assert.deepEqual(db.products.map(function (product) { return product.stock; }), [5, 10]);
});
