const assert = require('node:assert/strict');
const test = require('node:test');
const orders = require('../lib/orders');

const db = {
  orders: [
    { id: 1, date: '30/12/2025' },
    { id: 2, date: '31/12/2025' },
    { id: 3, date: '2026-01-01' },
    { id: 4, date: '02/01/2026' },
    { id: 5, date: '02/01/2026' },
    { id: 6, date: '03/01/2026' }
  ]
};

function ids(filters) {
  return orders.list(db, filters).map(order => order.id);
}

test('order history sorts newest first across years and keeps newer same-day orders first', () => {
  assert.deepEqual(ids(), [6, 5, 4, 3, 2, 1]);
  assert.deepEqual(db.orders.map(order => order.id), [1, 2, 3, 4, 5, 6]);
});

test('order history accepts inclusive date bounds in either format across a year boundary', () => {
  assert.deepEqual(ids({ from: '2025-12-31', to: '02/01/2026' }), [5, 4, 3, 2]);
  assert.deepEqual(ids({ from: '2026-01-02' }), [6, 5, 4]);
  assert.deepEqual(ids({ to: '31/12/2025' }), [2, 1]);
});
