const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');
const { fixture, http } = require('./helpers');

for (const id of [6, 11]) {
  test('exact sellable quantity is accepted for product ' + id, () => {
    const db = fixture();
    assert.equal(inventory.getSellableStock(inventory.find(db.products, id)), 1);
    assert.equal(inventory.check(db.products, [{ id, qty: 1 }]).ok, true);
  });
}
test('quantity below sellable stock succeeds and reserve deducts physical stock only', () => {
  const db = fixture();
  assert.deepEqual(inventory.check(db.products, [{ id: 4, qty: 2 }]), { ok: true });
  inventory.reserve(db.products, [{ id: 4, qty: 2 }]);
  assert.equal(db.products[2].stock, 20);
  assert.equal(db.products[2].reserved, 4);
});
test('reservations excluded, negative availability clamped, excess and zero stock rejected', () => {
  const db = fixture();
  assert.equal(inventory.getSellableStock(db.products[2]), 18);
  assert.equal(inventory.getSellableStock({ stock: 1, reserved: 3 }), 0);
  assert.equal(inventory.check(db.products, [{ id: 11, qty: 2 }]).ok, false);
  assert.equal(inventory.check(db.products, [{ id: 10, qty: 1 }]).ok, false);
  assert.equal(inventory.check(db.products, [{ id: 999, qty: 1 }]).ok, false);
});
test('cancellation changes status and restores physical stock without releasing reservations', () => {
  const db = fixture();
  const before = structuredClone(db.products);
  const otherOrder = structuredClone(db.orders[1]);
  assert.equal(orders.cancel(db, 1007, 'Customer request').ok, true);
  assert.equal(db.orders[0].status, 'cancelled');
  assert.equal(db.orders[0].cancelReason, 'Customer request');
  assert.ok(db.orders[0].cancelledAt);
  before[0].stock += 2;
  before[2].stock += 2;
  assert.deepEqual(db.products, before);
  assert.deepEqual(db.orders[1], otherOrder);
  assert.equal(db.customers[0].totalBilled, 0);
  assert.equal(db.customers[0].balance, 200);
  const after = structuredClone(db);
  assert.equal(orders.cancel(db, 1007).ok, false);
  assert.deepEqual(db, after);
});
test('existing cancellation policy accepts completed orders and rejects missing orders', () => {
  const db = fixture();
  assert.equal(orders.cancel(db, 1008).ok, true);
  const before = structuredClone(db);
  assert.deepEqual(orders.cancel(db, 999), { ok: false, error: 'Order not found' });
  assert.deepEqual(db, before);
});
test('HTTP order creation preserves quantity normalization and persistence conventions', async t => {
  const db = fixture();
  const api = await http(t, db);
  for (const qty of [0, -2, 'bad', 1.9, '2']) {
    const response = await api.request('/api/orders', { items: [{ id: 4, qty }] });
    assert.equal(response.status, 201);
    assert.equal(response.body.items[0].qty, qty === '2' ? 2 : 1);
  }
  assert.equal(api.writes(), 5);
  const before = structuredClone(db);
  assert.equal((await api.request('/api/orders', { items: [] })).status, 400);
  assert.equal((await api.request('/api/orders', { items: [{ id: 999, qty: 1 }] })).status, 400);
  assert.equal((await api.request('/api/orders', { items: [{ id: 4, qty: 99 }] })).status, 409);
  assert.deepEqual(db, before);
});
