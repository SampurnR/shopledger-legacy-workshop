var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

test('sales can use all sellable stock but cannot consume reservations', function () {
  var products = [
    { id: 6, name: 'Ghee', stock: 1, reserved: 0 },
    { id: 7, name: 'Chilli', stock: 4, reserved: 3 }
  ];
  var items = [{ id: 6, qty: 1 }, { id: 7, qty: 1 }];
  assert.equal(inventory.check(products, items).ok, true);
  assert.equal(inventory.check(products, [{ id: 7, qty: 2 }]).ok, false);
  assert.equal(inventory.check(products, [{ id: 7, qty: 1 }, { id: 7, qty: 1 }]).ok, false);
  inventory.reserve(products, items);
  assert.equal(products[0].stock, 0);
  assert.equal(products[1].stock, 3);
  assert.equal(products[1].reserved, 3);
});

test('cancelling a pending order restores physical stock once without changing reservations', function () {
  var db = {
    products: [{ id: 6, stock: 1, reserved: 1 }, { id: 4, stock: 5, reserved: 2 }],
    orders: [{ id: 1007, status: 'pending', items: [{ id: 6, qty: 2 }, { id: 4, qty: 2 }] }]
  };
  assert.equal(orders.cancel(db, 1007, 'test').ok, true);
  assert.equal(db.orders[0].status, 'cancelled');
  assert.deepEqual(db.products, [{ id: 6, stock: 3, reserved: 1 }, { id: 4, stock: 7, reserved: 2 }]);
  assert.equal(orders.cancel(db, 1007, 'again').ok, false);
  assert.equal(db.products[0].stock, 3);
});
