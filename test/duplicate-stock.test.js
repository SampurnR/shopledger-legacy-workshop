const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');
const { fixture, http } = require('./helpers');

for (const id of [6, 11]) {
  test('regression: combined duplicate quantities cannot exceed sellable stock for product ' + id, () => {
    const db = fixture();
    const before = structuredClone(db.products);
    assert.equal(inventory.check(db.products, [{ id, qty: 1 }, { id: String(id), qty: 1 }]).ok, false);
    assert.deepEqual(db.products, before);
  });
}
test('split duplicate quantities totaling exact sellable stock succeed and restore correctly', () => {
  const db = fixture();
  const items = [{ id: 4, qty: 9 }, { id: '4', qty: 9 }];
  assert.equal(inventory.check(db.products, items).ok, true);
  inventory.reserve(db.products, items);
  assert.equal(db.products[2].stock, 4);
  assert.equal(db.products[2].reserved, 4);
  inventory.release(db.products, items);
  assert.equal(db.products[2].stock, 22);
  assert.equal(db.products[2].reserved, 4);
});
test('HTTP rejects overselling duplicate lines without persisting an order or inventory change', async t => {
  const db = fixture();
  const api = await http(t, db);
  const before = structuredClone(db);
  for (const id of [6, 11]) {
    const result = await api.request('/api/orders', { items: [{ id, qty: 1 }, { id: String(id), qty: 1 }] });
    assert.equal(result.status, 409);
    assert.deepEqual(db, before);
    assert.equal(api.writes(), 0);
  }
});
