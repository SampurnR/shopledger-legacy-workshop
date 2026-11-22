'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const orders = require('../lib/orders');
const inventory = require('../lib/inventory');

const invalidCases = [
  ['missing quantity', [{ id: 6 }]],
  ['non-numeric quantity', [{ id: 6, qty: 'bad' }]],
  ['negative quantity', [{ id: 6, qty: -2 }]],
  ['zero quantity', [{ id: 6, qty: 0 }]],
  ['fractional quantity', [{ id: 6, qty: 1.5 }]],
  ['NaN quantity', [{ id: 6, qty: NaN }]],
  ['infinite quantity', [{ id: 6, qty: Infinity }]],
  ['missing product', [{ id: 999, qty: 2 }]],
  ['later invalid quantity', [{ id: 6, qty: 2 }, { id: 4, qty: 'bad' }]],
  ['later missing product', [{ id: 6, qty: 2 }, { id: 999, qty: 2 }]],
  ['null order line', [{ id: 6, qty: 2 }, null]],
  ['missing item list', undefined],
  ['malformed item list', {}]
];

function fixture(items) {
  return {
    products: [{ id: 6, stock: 6, reserved: 1 }, { id: 4, stock: 10, reserved: 3 }, { id: 99, stock: 20, reserved: 4 }],
    orders: [{ id: 1007, status: 'pending', items: structuredClone(items), paymentMode: 'khata', customerId: 7, total: 1280 }],
    customers: [{ id: 7, openingBalance: 100, totalBilled: 2000, totalSettled: 300, balance: 1800 }],
    auditLog: []
  };
}

for (const [name, items] of invalidCases) {
  test('cancellation rejects ' + name + ' without any state mutation', () => {
    const db = fixture(items);
    const before = structuredClone(db);
    const result = orders.cancel(db, 1007, 'Must not apply');
    assert.equal(result.ok, false);
    assert.equal(typeof result.error, 'string');
    assert.deepEqual(db, before, 'status, stock, reservations, Khata and unrelated state must be unchanged');
    // The helper must independently avoid partial restoration too.
    const release = inventory.release(db.products, db.orders[0].items);
    assert.equal(release.ok, false);
    assert.deepEqual(db, before);
  });
}

test('cancellation endpoint uses existing HTTP 400 failure contract and never writes invalid records', t => {
  const store = require('../lib/store');
  const router = require('../routes/orders');
  const handler = router.stack.find(layer => layer.route && layer.route.path === '/orders/:id/cancel').route.stack[0].handle;
  let db;
  t.mock.method(store, 'read', () => db);
  t.mock.method(store, 'write', () => assert.fail('failed cancellation must not persist'));
  t.mock.method(store, 'appendAudit', () => assert.fail('failed cancellation must not append audit'));
  for (const [name, items] of invalidCases) {
    db = fixture(items);
    const before = structuredClone(db);
    let status;
    const res = { status(code) { status = code; return this; }, json(body) { assert.equal(typeof body.error, 'string'); } };
    handler({ params: { id: '1007' }, body: {} }, res);
    assert.equal(status, 400, name);
    assert.deepEqual(db, before, name);
  }
});

test('valid numeric-string cancellation restores #1007 and reverses Khata exactly once', () => {
  const db = fixture([{ id: 6, qty: '2' }, { id: 4, qty: 2 }]);
  assert.equal(orders.cancel(db, 1007).ok, true);
  assert.deepEqual(db.products, [{ id: 6, stock: 8, reserved: 1 }, { id: 4, stock: 12, reserved: 3 }, { id: 99, stock: 20, reserved: 4 }]);
  assert.equal(db.orders[0].status, 'cancelled');
  assert.deepEqual(db.customers[0], { id: 7, openingBalance: 100, totalBilled: 720, totalSettled: 300, balance: 520 });
  const afterFirst = structuredClone(db);
  assert.equal(orders.cancel(db, 1007).ok, false);
  assert.deepEqual(db, afterFirst);
});
