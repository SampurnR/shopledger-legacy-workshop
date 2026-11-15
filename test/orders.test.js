const assert = require('node:assert/strict');
const test = require('node:test');
const orders = require('../lib/orders');

function listedIds(db, filters) {
  return orders.list(db, filters).map((order) => order.id);
}

test('order history sorts newest first across months and years', () => {
  const db = {
    orders: [
      { id: 1, date: '05/01/2025' },
      { id: 2, date: '30/12/2024' },
      { id: 3, date: '02/02/2025' },
      { id: 4, date: '15/02/2025' }
    ]
  };

  assert.deepEqual(listedIds(db), [4, 3, 1, 2]);
  assert.deepEqual(db.orders.map((order) => order.id), [1, 2, 3, 4]);
});

test('orders on the same day are sorted by descending ID in either date format', () => {
  const db = {
    orders: [
      { id: 2, date: '15/06/2025' },
      { id: 1, date: '15/06/2025' },
      { id: 3, date: '2025-06-15' }
    ]
  };

  assert.deepEqual(listedIds(db), [3, 2, 1]);
});

test('order history includes both date bounds within a month in either input format', () => {
  const db = {
    orders: [
      { id: 1, date: '11/06/2025' },
      { id: 2, date: '2025-06-12' },
      { id: 3, date: '10/06/2025' },
      { id: 4, date: '13/06/2025' }
    ]
  };

  assert.deepEqual(listedIds(db, { from: '2025-06-11', to: '2025-06-12' }), [2, 1]);
  assert.deepEqual(listedIds(db, { from: '11/06/2025', to: '12/06/2025' }), [2, 1]);
});

test('order history applies inclusive date bounds across months', () => {
  const db = {
    orders: [
      { id: 1, date: '29/06/2025' },
      { id: 2, date: '30/06/2025' },
      { id: 3, date: '01/07/2025' },
      { id: 4, date: '02/07/2025' },
      { id: 5, date: '03/07/2025' }
    ]
  };

  assert.deepEqual(listedIds(db, { from: '2025-06-30', to: '2025-07-02' }), [4, 3, 2]);
  assert.deepEqual(listedIds(db, { from: '2025-06-30' }), [5, 4, 3, 2]);
  assert.deepEqual(listedIds(db, { to: '2025-07-02' }), [4, 3, 2, 1]);
});

test('order history combines status, search, and date filters', () => {
  const db = {
    orders: [
      { id: 123, date: '11/06/2025', customer: 'Walk-in' },
      { id: 2, date: '12/06/2025', customer: 'Corner Market', status: 'completed' },
      { id: 3, date: '13/06/2025', coupon: 'CORNER10', status: 'completed' },
      { id: 4, date: '14/06/2025', customer: 'Corner Shop', status: 'cancelled' },
      { id: 5, date: '15/06/2025', coupon: 'CORNER10', status: 'completed' }
    ]
  };

  assert.deepEqual(listedIds(db, { status: 'completed', search: '  cOrNeR ', to: '2025-06-14' }), [3, 2]);
  assert.deepEqual(listedIds(db, { status: 'completed', search: '23' }), [123]);
});
