'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const orders = require('../lib/orders');
const inventory = require('../lib/inventory');

const invalidStocks = [
  ['null', null], ['undefined', undefined], ['empty string', ''],
  ['whitespace', ' \t '], ['true', true], ['false', false],
  ['text', 'bad'], ['NaN', NaN], ['Infinity', Infinity],
  ['negative', -1], ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
  ['fractional', 1.5]
];

function fixture(stock, duplicate = false) {
  return {
    products: [{ id: 6, stock: 6, reserved: 1 }, { id: 4, stock, reserved: 0 }, { id: 99, stock: 20, reserved: 4 }],
    // A valid first line proves a failure on the later product is atomic.
    orders: [{ id: 1007, status: 'pending', paymentMode: 'khata', customerId: 7, total: 1280,
      items: [{ id: 6, qty: 2 }, { id: 4, qty: duplicate ? 1 : 2 }, ...(duplicate ? [{ id: '4', qty: 1 }] : [])] }],
    customers: [{ id: 7, openingBalance: 100, totalBilled: 2000, totalSettled: 300, balance: 1800 }],
    auditLog: []
  };
}

function assertRejected(db) {
  const before = structuredClone(db);
  const result = orders.cancel(db, 1007);
  assert.equal(result.ok, false);
  assert.match(result.error, /physical stock/i);
  assert.deepEqual(db, before);
  assert.equal(inventory.release(db.products, db.orders[0].items).ok, false);
  assert.deepEqual(db, before, 'direct release must not partially restore the valid first product');
}

for (const [name, stock] of invalidStocks) {
  test('cancellation rejects original physical stock: ' + name, () => {
    assertRejected(fixture(stock));
  });
}

test('restoration rejects resulting-stock overflow without partial mutation', () => {
  // MAX_SAFE_INTEGER - 1 + 2 cannot be represented as a safe integer.
  assertRejected(fixture(Number.MAX_SAFE_INTEGER - 1));
});

test('duplicate restoration rejects cumulative overflow without partial mutation', () => {
  // First +1 reaches MAX_SAFE_INTEGER; the duplicate +1 would exceed it.
  assertRejected(fixture(Number.MAX_SAFE_INTEGER - 1, true));
});

test('stock validation failures return HTTP 400 with no writes or audit mutations', t => {
  const store = require('../lib/store');
  const router = require('../routes/orders');
  const handler = router.stack.find(layer => layer.route && layer.route.path === '/orders/:id/cancel').route.stack[0].handle;
  let db;
  t.mock.method(store, 'read', () => db);
  const write = t.mock.method(store, 'write', () => assert.fail('must not persist invalid stock'));
  const audit = t.mock.method(store, 'appendAudit', () => assert.fail('must not audit failed cancellation'));
  for (const [stock, duplicate] of [
    ...invalidStocks.map(([, stock]) => [stock, false]),
    [Number.MAX_SAFE_INTEGER - 1, false], [Number.MAX_SAFE_INTEGER - 1, true]
  ]) {
    db = fixture(stock, duplicate);
    const before = structuredClone(db);
    let status;
    handler({ params: { id: '1007' }, body: {} }, {
      status(code) { status = code; return this; },
      json(body) { assert.match(body.error, /physical stock/i); }
    });
    assert.equal(status, 400);
    assert.deepEqual(db, before);
  }
  assert.equal(write.mock.callCount(), 0);
  assert.equal(audit.mock.callCount(), 0);
});

test('nonnegative numeric and numeric-string stock restores for pending and completed orders', () => {
  for (const stock of [0, 10, '0', '10', ' 10 ']) {
    for (const status of ['pending', 'completed']) {
      const db = fixture(stock);
      db.orders[0].status = status;
      assert.equal(orders.cancel(db, 1007).ok, true);
      assert.deepEqual(db.products, [
        { id: 6, stock: 8, reserved: 1 },
        { id: 4, stock: stock === 0 || stock === '0' ? 2 : 12, reserved: 0 },
        { id: 99, stock: 20, reserved: 4 }
      ]);
      const after = structuredClone(db);
      assert.equal(orders.cancel(db, 1007).ok, false);
      assert.deepEqual(db, after);
    }
  }
});
