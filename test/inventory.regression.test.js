const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

test('REGRESSION: sell the last unreserved unit and reach zero physical stock', () => {
  const p = { id: 6, name: 'Fixture ghee', stock: 1, reserved: 0 };
  const items = [{ id: 6, qty: 1 }];
  assert.equal(inventory.check([p], items).ok, true);
  inventory.reserve([p], items);
  assert.equal(p.stock, 0);
  assert.equal(inventory.getSellableStock(p), 0);
});

test('REGRESSION: sell the last sellable unit without consuming three wholesale holds', () => {
  const p = { id: 11, name: 'Fixture chilli', stock: 4, reserved: 3 };
  const items = [{ id: 11, qty: 1 }];
  assert.equal(inventory.check([p], items).ok, true);
  inventory.reserve([p], items);
  assert.equal(p.stock, 3);
  assert.equal(p.reserved, 3);
  assert.equal(inventory.getSellableStock(p), 0);
  assert.equal(inventory.check([p], items).ok, false);
});

test('REGRESSION: buying all sellable stock still rejects any quantity above it', () => {
  const p = { id: 1, name: 'Fixture rice', stock: 18, reserved: 2 };
  assert.equal(inventory.check([p], [{ id: 1, qty: 16 }]).ok, true);
  assert.equal(inventory.check([p], [{ id: 1, qty: 17 }]).ok, false);
});

test('REGRESSION: cancelling pending order restores every line once and preserves holds', () => {
  const db = {
    products: [{ id: 6, stock: 1, reserved: 0 }, { id: 4, stock: 22, reserved: 4 }],
    orders: [{ id: 1007, status: 'pending', paymentMode: 'cash', total: 1407,
      items: [{ id: 6, qty: 2 }, { id: 4, qty: 2 }] }]
  };
  assert.equal(orders.cancel(db, 1007).ok, true);
  assert.equal(db.orders[0].status, 'cancelled');
  assert.deepEqual(db.products, [
    { id: 6, stock: 3, reserved: 0 }, { id: 4, stock: 24, reserved: 4 }
  ]);
  const once = structuredClone(db.products);
  assert.equal(orders.cancel(db, 1007).ok, false);
  assert.deepEqual(db.products, once);
});

test('REGRESSION: reserve and release round trip physical stock and wholesale holds', () => {
  const p = { id: 1, stock: 10, reserved: 3 };
  const initial = { ...p };
  const items = [{ id: '1', qty: '2' }];
  inventory.reserve([p], items);
  inventory.release([p], items);
  assert.deepEqual(p, initial);
});

test('REGRESSION: release adds numeric quantities to physical stock, never concatenates', () => {
  const p = { id: 1, stock: '8', reserved: 3 };
  inventory.release([p], [{ id: '1', qty: '2' }]);
  assert.equal(p.stock, 10);
  assert.equal(p.reserved, 3);
});

test('REGRESSION: products with no sellable stock remain unavailable', () => {
  for (const p of [{ id: 1, stock: 0, reserved: 0 }, { id: 1, stock: 3, reserved: 3 }]) {
    assert.equal(inventory.check([p], [{ id: 1, qty: 1 }]).ok, false);
  }
});
