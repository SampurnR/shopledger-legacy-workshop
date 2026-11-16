var test = require('node:test');
var assert = require('node:assert/strict');

var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

test('inventory allows buying the exact last sellable unit', function () {
  var products = [
    { id: 6, name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 }
  ];

  var result = inventory.check(products, [{ id: 6, qty: 1 }]);

  assert.deepEqual(result, { ok: true });
});

test('inventory allows buying the exact remaining stock after reservations', function () {
  var products = [
    { id: 11, name: 'Byadgi Kashmiri Chilli Powder 500g', stock: 4, reserved: 3 }
  ];

  var result = inventory.check(products, [{ id: 11, qty: 1 }]);

  assert.deepEqual(result, { ok: true });
});

test('cancelling an order marks it cancelled and restores physical stock', function () {
  var db = {
    orders: [{
      id: 1007,
      status: 'pending',
      paymentMode: 'cash',
      items: [
        { id: 6, name: 'A2 Gir Cow Ghee 500ml', qty: 2 },
        { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', qty: 2 }
      ]
    }],
    products: [
      { id: 6, stock: 1, reserved: 0 },
      { id: 4, stock: 20, reserved: 4 }
    ],
    customers: []
  };

  var result = orders.cancel(db, 1007, 'Cancelled from order desk');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.deepEqual(db.products, [
    { id: 6, stock: 3, reserved: 0 },
    { id: 4, stock: 22, reserved: 4 }
  ]);
});
