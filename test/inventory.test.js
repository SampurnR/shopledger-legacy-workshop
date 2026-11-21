var assert = require('assert');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

function test(name, fn) {
  try {
    fn();
    console.log('PASS ' + name);
  } catch (err) {
    console.error('FAIL ' + name);
    throw err;
  }
}

test('allows a sale that uses exactly all sellable stock', function () {
  var products = [{ id: 1, name: 'Ghee', stock: 4, reserved: 3 }];
  assert.deepStrictEqual(inventory.check(products, [{ id: 1, qty: 1 }]), { ok: true });
});

test('rejects a sale greater than sellable stock', function () {
  var products = [{ id: 1, name: 'Ghee', stock: 4, reserved: 3 }];
  var result = inventory.check(products, [{ id: 1, qty: 2 }]);
  assert.strictEqual(result.ok, false);
  assert.match(result.msg, /1 sellable available/);
});

test('cancelling a pending order restores physical stock and preserves reserved stock', function () {
  var db = {
    products: [
      { id: 6, name: 'Ghee', stock: 0, reserved: 0 },
      { id: 4, name: 'Sunflower Oil', stock: 20, reserved: 4 }
    ],
    orders: [],
    customers: []
  };
  var order = {
    id: 1007,
    status: 'pending',
    paymentMode: 'cash',
    total: 1407,
    items: [{ id: 6, qty: 2 }, { id: 4, qty: 2 }]
  };
  db.orders.push(order);

  var result = orders.cancel(db, 1007, 'Test cancellation');

  assert.strictEqual(result.ok, true);
  assert.strictEqual(db.products[0].stock, 2);
  assert.strictEqual(db.products[1].stock, 22);
  assert.strictEqual(db.products[0].reserved, 0);
  assert.strictEqual(db.products[1].reserved, 4);
  assert.strictEqual(order.status, 'cancelled');
});

test('repeated cancellation does not restore stock twice', function () {
  var db = {
    products: [{ id: 6, name: 'Ghee', stock: 0, reserved: 1 }],
    orders: [{
      id: 1007,
      status: 'pending',
      paymentMode: 'cash',
      items: [{ id: 6, qty: 2 }]
    }],
    customers: []
  };

  assert.strictEqual(orders.cancel(db, 1007).ok, true);
  assert.strictEqual(db.products[0].stock, 2);
  var secondResult = orders.cancel(db, 1007);
  assert.strictEqual(secondResult.ok, false);
  assert.strictEqual(db.products[0].stock, 2);
});

test('release safely skips products missing from the catalog', function () {
  var products = [{ id: 1, stock: 5, reserved: 2 }];
  inventory.release(products, [{ id: 999, qty: 3 }]);
  assert.strictEqual(products[0].stock, 5);
  assert.strictEqual(products[0].reserved, 2);
});
