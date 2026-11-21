var assert = require('node:assert/strict');
var test = require('node:test');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

test('allows selling exactly the remaining sellable stock', function () {
  var product = { id: 1, name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 };

  assert.deepEqual(inventory.check([product], [{ id: 1, qty: 1 }]), { ok: true });
});

test('rejects a quantity greater than remaining sellable stock', function () {
  var product = { id: 1, name: 'A2 Gir Cow Ghee 500ml', stock: 2, reserved: 1 };

  var result = inventory.check([product], [{ id: 1, qty: 2 }]);

  assert.equal(result.ok, false);
  assert.match(result.msg, /1 sellable available/);
});

test('cancelling an order restores its stock without changing quote reservations', function () {
  var db = {
    products: [{ id: 1, name: 'A2 Gir Cow Ghee 500ml', stock: 2, reserved: 1 }],
    orders: [{
      id: 1007,
      date: '15/03/2022',
      status: 'pending',
      paymentMode: 'cash',
      items: [{ id: 1, qty: 1 }],
      total: 450
    }]
  };

  inventory.reserve(db.products, db.orders[0].items);
  assert.equal(db.products[0].stock, 1);

  var result = orders.cancel(db, 1007, 'Test cancellation');

  assert.equal(result.ok, true);
  assert.equal(db.products[0].stock, 2);
  assert.equal(db.products[0].reserved, 1);
});
