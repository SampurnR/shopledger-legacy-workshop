const assert = require('node:assert/strict');
const test = require('node:test');
const orders = require('../lib/orders');

const early = { id: 1001, date: '02/06/2026', customer: 'Asha', status: 'pending' };
const middle = { id: 1002, date: '12/06/2026', customer: 'Dev', coupon: 'SAVE10', status: 'completed' };
const late = { id: 1003, date: '24/06/2026' };

test('order history lists orders newest first without reordering stored records', () => {
  const db = { orders: [early, late, middle] };

  assert.deepEqual(orders.list(db), [late, middle, early]);
  assert.deepEqual(orders.list(db, { status: 'all' }), [late, middle, early]);
  assert.deepEqual(db.orders, [early, late, middle]);
});

test('order history filters by status and treats a missing status as completed', () => {
  const db = { orders: [early, late, middle] };

  assert.deepEqual(orders.list(db, { status: 'completed' }), [late, middle]);
  assert.deepEqual(orders.list(db, { status: 'pending' }), [early]);
});

test('order history searches order IDs, customer names, and coupon codes', () => {
  const db = { orders: [early, late, middle] };

  assert.deepEqual(orders.list(db, { search: '1002' }), [middle]);
  assert.deepEqual(orders.list(db, { search: '  ASHA ' }), [early]);
  assert.deepEqual(orders.list(db, { search: 'save10' }), [middle]);
  assert.deepEqual(orders.list(db, { search: 'walk-in' }), [late]);
});

test('order history includes both date boundaries within a month', () => {
  const db = { orders: [early, late, middle] };

  assert.deepEqual(orders.list(db, { from: '2026-06-02', to: '2026-06-12' }), [middle, early]);
  assert.deepEqual(orders.list(db, { from: '2026-06-12', to: '2026-06-24' }), [late, middle]);
});
