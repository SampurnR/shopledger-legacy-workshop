const test = require('node:test');
const assert = require('node:assert/strict');
const orders = require('../lib/orders');

// Hand-built fixtures only; importing orders does not load the persistence layer.
function fixture() {
  return { orders: [
    { id: 1001, date: '28/12/2021', customer: 'Meera Joshi' },
    { id: 1004, date: '30/01/2022', customer: 'Meera Joshi', status: 'completed' },
    { id: 1007, date: '04/03/2022', customer: 'Other', status: 'pending' },
    { id: 1008, date: '15/03/2022', customer: 'Other', status: 'cancelled' }
  ] };
}

function ids(list) {
  return list.map(order => order.id);
}

test('orders list newest first in calendar order', () => {
  const db = fixture();
  const before = structuredClone(db);
  const result = orders.list(db);
  assert.deepEqual(ids(result), [1008, 1007, 1004, 1001]);
  assert.deepEqual(db, before);
  assert.notStrictEqual(result, db.orders);
  assert.strictEqual(result[0], db.orders[3]);
});

test('January date range returns only January orders', () => {
  assert.deepEqual(ids(orders.list(fixture(), {
    from: '2022-01-01', to: '2022-01-31'
  })), [1004]);
});

test('from-only filter includes orders on and after the requested date', () => {
  assert.deepEqual(ids(orders.list(fixture(), { from: '2022-01-30' })), [1008, 1007, 1004]);
});

test('to-only filter includes orders on and before the requested date', () => {
  assert.deepEqual(ids(orders.list(fixture(), { to: '2022-03-15' })), [1008, 1007, 1004, 1001]);
});

test('date boundaries are inclusive and accept both supported formats', () => {
  for (const date of ['2022-01-30', '30/01/2022']) {
    assert.deepEqual(ids(orders.list(fixture(), { from: date, to: date })), [1004]);
  }
  assert.deepEqual(ids(orders.list(fixture(), { from: '', to: '', status: 'all' })),
    [1008, 1007, 1004, 1001]);
});

test('status and case-insensitive customer search combine with date range', () => {
  assert.deepEqual(ids(orders.list(fixture(), {
    status: 'completed', search: ' MEERA ', from: '2022-01-01', to: '2022-01-31'
  })), [1004]);
  assert.deepEqual(ids(orders.list(fixture(), { search: '1007' })), [1007]);
  assert.deepEqual(orders.list({ orders: [] }), []);
});
