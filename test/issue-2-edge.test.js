'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

test('stock validation rejects invalid quantities and unknown products without mutation', () => {
  const products = [{ id: 1, name: 'Fixture', stock: 10, reserved: 2 }];
  for (const qty of [0, -1, 1.5, NaN, Infinity, undefined, null, '', 'bad', true]) {
    assert.equal(inventory.check(products, [{ id: 1, qty }]).ok, false, String(qty));
  }
  assert.deepEqual(inventory.check(products, [{ id: 99, qty: 1 }]), { ok: false, msg: 'Unknown product 99' });
  assert.deepEqual(products, [{ id: 1, name: 'Fixture', stock: 10, reserved: 2 }]);
});

test('duplicate product lines cannot jointly exceed sellable stock', () => {
  const products = [{ id: 1, name: 'Fixture', stock: 5, reserved: 2 }];
  assert.equal(inventory.check(products, [{ id: 1, qty: 2 }, { id: '1', qty: 2 }]).ok, false);
  assert.equal(products[0].stock, 5);
  assert.equal(products[0].reserved, 2);
});

test('duplicate lines exactly consuming sellable stock restore correctly on completed-order cancellation', () => {
  const db = { products: [{ id: 1, name: 'Fixture', stock: 5, reserved: 2 }], orders: [], nextOrderId: 1 };
  const items = [{ id: 1, qty: '1' }, { id: '1', qty: 2 }];
  assert.equal(inventory.check(db.products, items).ok, true);
  inventory.reserve(db.products, items);
  assert.equal(db.products[0].stock, 2);
  orders.add(db, { items, status: 'completed', paymentMode: 'cash' });
  assert.equal(orders.cancel(db, 1).ok, true);
  assert.deepEqual(db.products, [{ id: 1, name: 'Fixture', stock: 5, reserved: 2 }]);
  assert.equal(orders.cancel(db, 1).ok, false);
  assert.equal(db.products[0].stock, 5);
});

test('failure on a later line leaves earlier products untouched', () => {
  const products = [{ id: 1, name: 'One', stock: 5, reserved: 1 }, { id: 2, name: 'Two', stock: 2, reserved: 2 }];
  const before = structuredClone(products);
  assert.equal(inventory.check(products, [{ id: 1, qty: 1 }, { id: 2, qty: 1 }]).ok, false);
  assert.deepEqual(products, before);
});

test('order endpoint rejects invalid input quantities before stock or ledger updates', t => {
  // Replace storage methods before invoking the route: no real database I/O.
  const store = require('../lib/store');
  const router = require('../routes/orders');
  const handler = router.stack.find(layer => layer.route && layer.route.path === '/orders' && layer.route.methods.post).route.stack[0].handle;
  const db = { products: [{ id: 1, name: 'Fixture', price: 100, hsn: '1006', stock: 10, reserved: 2 }], orders: [] };
  const before = structuredClone(db);
  t.mock.method(store, 'read', () => db);
  t.mock.method(store, 'write', () => assert.fail('invalid requests must not persist'));
  for (const qty of [0, -1, 1.5, '2abc', '', null, undefined, true]) {
    let status;
    const res = { status(code) { status = code; return this; }, json(body) { assert.match(body.error, /quantity/i); } };
    handler({ body: { items: [{ id: 1, qty }] } }, res);
    assert.equal(status, 400, String(qty));
    assert.deepEqual(db, before);
  }
});
