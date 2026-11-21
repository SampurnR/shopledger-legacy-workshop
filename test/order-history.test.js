const assert = require('node:assert/strict');
const { test } = require('node:test');
const orders = require('../lib/orders');

function orderIds(db, filters) {
  return orders.list(db, filters).map((order) => order.id);
}

test('order history combines status and trimmed, case-insensitive search', () => {
  const db = {
    orders: [
      { id: 1001, date: '10/06/2021', customer: 'Corner Shop' },
      { id: 1002, date: '11/06/2021', coupon: 'CORNER10', status: 'completed' },
      { id: 1003, date: '12/06/2021', customer: 'Corner Market', status: 'cancelled' }
    ]
  };

  assert.deepEqual(orderIds(db, { status: 'completed', search: '  CoRnEr ' }), [1002, 1001]);
  assert.deepEqual(orderIds(db, { status: 'all', search: '003' }), [1003]);
  assert.deepEqual(orderIds(db), [1003, 1002, 1001]);
  assert.deepEqual(db.orders.map((order) => order.id), [1001, 1002, 1003]);
});

test('order history includes both date bounds within a month in either input format', () => {
  const db = {
    orders: [
      { id: 1, date: '09/06/2021' },
      { id: 2, date: '10/06/2021' },
      { id: 3, date: '11/06/2021' },
      { id: 4, date: '12/06/2021' },
      { id: 5, date: '13/06/2021' }
    ]
  };

  assert.deepEqual(orderIds(db, { from: '2021-06-10', to: '2021-06-12' }), [4, 3, 2]);
  assert.deepEqual(orderIds(db, { from: '10/06/2021', to: '12/06/2021' }), [4, 3, 2]);
});

test('order history sorts newest first across months and years', () => {
  const db = {
    orders: [
      { id: 1, date: '31/12/2021' },
      { id: 2, date: '01/01/2022' },
      { id: 3, date: '20/01/2022' },
      { id: 4, date: '01/02/2022' }
    ]
  };

  assert.deepEqual(orderIds(db), [4, 3, 2, 1]);
});

test('order history reverses the stored order of same-date entries', () => {
  const db = {
    orders: [
      { id: 3, date: '10/06/2021' },
      { id: 1, date: '10/06/2021' },
      { id: 2, date: '10/06/2021' }
    ]
  };

  assert.deepEqual(orderIds(db), [2, 1, 3]);
});

test('a cross-month date range includes orders on both endpoints', () => {
  const db = {
    orders: [
      { id: 1, date: '01/06/2021' },
      { id: 2, date: '30/06/2021' },
      { id: 3, date: '01/07/2021' },
      { id: 4, date: '02/07/2021' },
      { id: 5, date: '31/07/2021' }
    ]
  };

  assert.deepEqual(orderIds(db, { from: '2021-06-30', to: '2021-07-02' }), [4, 3, 2]);
});

test('one-sided date filters compare dates chronologically', () => {
  const db = {
    orders: [
      { id: 1, date: '30/06/2021' },
      { id: 2, date: '01/07/2021' },
      { id: 3, date: '02/07/2021' },
      { id: 4, date: '31/07/2021' }
    ]
  };

  assert.deepEqual(orderIds(db, { from: '2021-06-30' }), [4, 3, 2, 1]);
  assert.deepEqual(orderIds(db, { to: '2021-07-02' }), [3, 2, 1]);
});

test('order history accepts mixed date formats in records and across year boundaries', () => {
  const db = {
    orders: [
      { id: 1, date: '30/12/2021' },
      { id: 2, date: '31/12/2021' },
      { id: 3, date: '2022-01-01' },
      { id: 4, date: '02/01/2022' }
    ]
  };

  assert.deepEqual(orderIds(db, { from: '31/12/2021', to: '2022-01-01' }), [3, 2]);
});
