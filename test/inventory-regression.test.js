const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

test('REGRESSION: duplicate product lines cannot collectively exceed sellable stock', () => {
  const products = [{ id: 1, name: 'Rice', stock: 10, reserved: 3 }];
  const before = structuredClone(products);
  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 4 }, { id: '1', qty: '4' }]), {
    ok: false, msg: 'Rice is out of stock (7 sellable available)'
  });
  assert.deepEqual(products, before);
  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 3 }, { id: '1', qty: '4' }]), { ok: true });
  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 2 }, { id: 1, qty: 3 }]), { ok: true });
});

// These fixtures stay in memory. No store module or application server is loaded.
test('REGRESSION: purchasing exactly the sellable stock succeeds', () => {
  const products = [{ id: 1, name: 'Rice', stock: 10, reserved: 3 }];
  const items = [{ id: 1, qty: 7 }];

  assert.equal(inventory.getSellableStock(products[0]), 7);
  assert.deepEqual(inventory.check(products, items), { ok: true });

  inventory.reserve(products, items);
  assert.deepEqual(products, [{ id: 1, name: 'Rice', stock: 3, reserved: 3 }]);
  assert.equal(inventory.getSellableStock(products[0]), 0);
});

test('REGRESSION: cancelling a pending order restores stock exactly once', () => {
  const db = {
    nextOrderId: 1001,
    products: [{ id: 1, name: 'Rice', stock: 10, reserved: 3 }],
    orders: [],
    customers: []
  };
  const originalProducts = structuredClone(db.products);
  const items = [{ id: 1, name: 'Rice', price: 50, qty: 2 }];

  // Follow the route's reserve-before-add sequence and its actual item ID shape.
  assert.deepEqual(inventory.check(db.products, items), { ok: true });
  inventory.reserve(db.products, items);
  const order = orders.add(db, {
    status: 'pending', paymentMode: 'cash', items,
    subtotal: 100, discount: 0, tax: 0, total: 100
  });
  assert.equal(db.products[0].stock, 8);

  const firstCancellation = orders.cancel(db, order.id, 'Customer cancelled');
  assert.equal(firstCancellation.ok, true);
  assert.equal(order.status, 'cancelled');
  const afterFirstCancellation = structuredClone(db.products);

  // Exercise the repeated request even while the restoration assertion is failing.
  assert.deepEqual(orders.cancel(db, order.id), {
    ok: false, error: 'Order #1001 is already cancelled'
  });
  assert.deepEqual(db.products, afterFirstCancellation, 'Repeated cancellation must not change stock');
  assert.deepEqual(afterFirstCancellation, originalProducts, 'First cancellation must restore deducted stock and preserve reservations');
  assert.equal(inventory.getSellableStock(db.products[0]), 7);
});
