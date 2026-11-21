var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

// Synthetic objects only; no storage or application server imports.
function product(stock, reserved) {
  return { id: 1, name: 'Test product', stock: stock, reserved: reserved };
}

function pendingOrder() {
  return {
    products: [product(1, 0), { id: 2, name: 'Test oil', stock: 4, reserved: 3 }],
    orders: [{ id: 1007, status: 'pending', paymentMode: 'cash',
      items: [{ id: 1, qty: 2 }, { id: 2, qty: 2 }] }]
  };
}

test('sellable stock excludes reservations and never becomes negative', function () {
  assert.equal(inventory.getSellableStock(product(4, 3)), 1);
  assert.equal(inventory.getSellableStock(product(2, 3)), 0);
});

test('REGRESSION: the last sellable unit can be sold with and without reservations', function () {
  [product(1, 0), product(4, 3)].forEach(function (p) {
    assert.deepEqual(inventory.check([p], [{ id: 1, qty: 1 }]), {
      ok: true
    });
  });
});

test('stock checks reject unavailable quantities and unknown products without mutation', function () {
  var products = [product(4, 3)];
  var before = JSON.stringify(products);
  assert.equal(inventory.check(products, [{ id: 1, qty: 2 }]).ok, false);
  assert.equal(inventory.check([product(3, 3)], [{ id: 1, qty: 1 }]).ok, false);
  assert.equal(inventory.check([product(0, 0)], [{ id: 1, qty: 1 }]).ok, false);
  assert.deepEqual(inventory.check(products, [{ id: 9, qty: 1 }]), {
    ok: false, msg: 'Unknown product 9'
  });
  assert.equal(JSON.stringify(products), before);
});

test('reserve deducts physical stock and preserves wholesale reservations', function () {
  var products = [product(8, 3)];
  assert.equal(inventory.check(products, [{ id: 1, qty: 2 }]).ok, true);
  inventory.reserve(products, [{ id: 1, qty: 2 }]);
  assert.deepEqual(products, [product(6, 3)]);
});

test('REGRESSION: cancelling an order restores physical stock without changing reservations', function () {
  var db = pendingOrder();
  assert.equal(orders.cancel(db, 1007, 'Test cancellation').ok, true);
  assert.equal(db.orders[0].status, 'cancelled');
  assert.deepEqual(db.products.map(function (p) { return [p.stock, p.reserved]; }), [[3, 0], [6, 3]]);
});

test('cancelling an order twice rejects the second attempt without changing stock', function () {
  var db = pendingOrder();
  orders.cancel(db, 1007, 'First attempt');
  var afterFirst = JSON.stringify(db);
  assert.equal(orders.cancel(db, 1007, 'Second attempt').ok, false);
  assert.equal(JSON.stringify(db), afterFirst);
});

test('release skips products that no longer exist', function () {
  var products = [product(4, 3)];
  inventory.release(products, [{ id: 9, qty: 2 }]);
  assert.deepEqual(products, [product(4, 3)]);
});

test('REGRESSION: selling all sellable stock then cancelling restores the starting quantities', function () {
  var db = { products: [product(8, 3)], orders: [] };
  var items = [{ id: 1, qty: 5 }];
  assert.equal(inventory.check(db.products, items).ok, true);
  inventory.reserve(db.products, items);
  assert.deepEqual(db.products, [product(3, 3)]);
  db.orders.push({ id: 1, status: 'completed', paymentMode: 'cash', items: items });
  assert.equal(orders.cancel(db, 1, 'Test cancellation').ok, true);
  assert.deepEqual(db.products, [product(8, 3)]);
});
