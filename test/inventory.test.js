'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

test('allows selling all remaining sellable stock', function () {
  var products = [
    { id: 1, name: 'Test rice', stock: 5, reserved: 2 }
  ];

  var result = inventory.check(products, [{ id: 1, qty: 3 }]);

  assert.deepStrictEqual(result, { ok: true });
});

test('still rejects quantities above remaining sellable stock', function () {
  var products = [
    { id: 1, name: 'Test rice', stock: 5, reserved: 2 }
  ];

  var result = inventory.check(products, [{ id: 1, qty: 4 }]);

  assert.deepStrictEqual(result, {
    ok: false,
    msg: 'Test rice is out of stock (3 sellable available)'
  });
});

test('rejects duplicate product lines whose combined quantity exceeds sellable stock', function () {
  var products = [
    { id: 2, name: 'Test beans', stock: 5, reserved: 0 }
  ];
  var items = [
    { id: 2, qty: 3 },
    { id: 2, qty: 3 }
  ];

  var result = inventory.check(products, items);

  assert.deepStrictEqual(result, {
    ok: false,
    msg: 'Test beans is out of stock (5 sellable available)'
  });
});

test('does not reserve duplicate lines when their combined quantity exceeds stock', function () {
  var products = [
    { id: 2, name: 'Test beans', stock: 5, reserved: 0 }
  ];
  var items = [
    { id: 2, qty: 3 },
    { id: 2, qty: 3 }
  ];

  inventory.reserve(products, items);

  assert.strictEqual(products[0].stock, 5);
});

test('allows and reserves duplicate lines totaling exactly the sellable stock', function () {
  var products = [
    { id: 2, name: 'Test beans', stock: 7, reserved: 2 }
  ];
  var items = [
    { id: 2, qty: 2 },
    { id: 2, qty: 3 }
  ];

  assert.deepStrictEqual(inventory.check(products, items), { ok: true });
  inventory.reserve(products, items);

  assert.strictEqual(products[0].stock, 2);
  assert.strictEqual(products[0].reserved, 2);
});

test('cancelling Pending Order #1007 restores physical stock', function () {
  // In-memory snapshot after the pending order's quantities have been deducted.
  var db = {
    products: [
      { id: 6, name: 'Test ghee', stock: 3, reserved: 1 }
    ],
    orders: [
      {
        id: 1007,
        status: 'pending',
        paymentMode: 'cash',
        total: 100,
        items: [{ id: 6, name: 'Test ghee', qty: 2, price: 50 }]
      }
    ]
  };

  var result = orders.cancel(db, 1007, 'Workshop characterization');

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.order.status, 'cancelled');
  assert.strictEqual(db.products[0].stock, 5);
  assert.strictEqual(db.products[0].reserved, 1);
});
