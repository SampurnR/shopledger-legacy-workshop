const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');
const { fixture, http } = require('./helpers');

for (const id of [6, 11, 4]) {
  test('regression: can purchase the exact sellable quantity of product ' + id, () => {
    const db = fixture();
    const p = inventory.find(db.products, id);
    const qty = inventory.getSellableStock(p);
    assert.equal(inventory.check(db.products, [{ id, qty }]).ok, true);
    inventory.reserve(db.products, [{ id, qty }]);
    assert.equal(p.stock, p.reserved);
    assert.equal(inventory.getSellableStock(p), 0);
    assert.equal(inventory.check(db.products, [{ id, qty: 1 }]).ok, false);
  });
}
test('regression: cancellation restores every physical quantity, preserving reservations and other orders', () => {
  const db = fixture();
  const before = structuredClone(db);
  assert.equal(orders.cancel(db, 1007, 'Customer request').ok, true);
  assert.equal(db.orders[0].status, 'cancelled');
  for (const item of before.orders[0].items) {
    const original = inventory.find(before.products, item.id);
    const restored = inventory.find(db.products, item.id);
    assert.equal(restored.stock, original.stock + item.qty);
    assert.equal(restored.reserved, original.reserved);
    assert.equal(inventory.getSellableStock(restored), inventory.getSellableStock(original) + item.qty);
  }
  assert.deepEqual(db.products[1], before.products[1]);
  assert.deepEqual(db.orders[1], before.orders[1]);
  assert.equal(db.customers[0].balance, 200);
  const once = structuredClone(db);
  assert.equal(orders.cancel(db, 1007).ok, false);
  assert.deepEqual(db, once);
});
test('regression: release uses order item id and numeric quantity; missing products remain ignored', () => {
  const products = [{ id: 4, stock: 22, reserved: 4 }];
  inventory.release(products, [{ id: 4, qty: '2' }, { id: 999, qty: 3 }]);
  assert.deepEqual(products, [{ id: 4, stock: 24, reserved: 4 }]);
});
test('regression: HTTP exact sales persist and cancellation restores once with history and audit', async t => {
  const db = fixture();
  const api = await http(t, db);
  for (const id of [6, 11]) {
    const result = await api.request('/api/orders', { status: 'pending', items: [{ id, qty: 1 }] });
    assert.equal(result.status, 201);
    assert.equal(inventory.find(db.products, id).stock, id === 6 ? 0 : 3);
    const before = structuredClone(db);
    assert.equal((await api.request('/api/orders', { items: [{ id, qty: 1 }] })).status, 409);
    assert.deepEqual(db, before);
    assert.equal((await api.request('/api/orders/' + result.body.id + '/cancel', {})).status, 200);
    assert.equal(inventory.find(db.products, id).stock, id === 6 ? 1 : 4);
    const cancelled = structuredClone(db);
    const writes = api.writes();
    assert.equal((await api.request('/api/orders/' + result.body.id + '/cancel', {})).status, 400);
    assert.deepEqual(db, cancelled);
    assert.equal(api.writes(), writes);
    const history = await api.request('/api/orders');
    assert.equal(history.body.find(o => o.id === result.body.id).status, 'cancelled');
  }
  assert.equal(db.auditLog.filter(e => e.action === 'ORDER_CREATED').length, 2);
  assert.equal(db.auditLog.filter(e => e.action === 'ORDER_CANCELLED').length, 2);
});
