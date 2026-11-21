const assert = require('node:assert/strict');
const test = require('node:test');
const orders = require('../lib/orders');

const db = {
  orders: [
    { id: 1001, date: '28/12/2021' },
    { id: 1004, date: '30/01/2022' },
    { id: 1007, date: '04/03/2022' },
    { id: 1008, date: '15/03/2022' }
  ]
};

function ids(filters) {
  return orders.list(db, filters).map(order => order.id);
}

test('lists orders newest first across months and years', () => {
  assert.deepEqual(ids(), [1008, 1007, 1004, 1001]);
});

test('filters dates inclusively and accepts both date formats', () => {
  assert.deepEqual(ids({ from: '2022-01-01', to: '2022-01-31' }), [1004]);
  assert.deepEqual(ids({ from: '30/01/2022', to: '30/01/2022' }), [1004]);
  assert.deepEqual(ids({ from: '2022-03-04' }), [1008, 1007]);
  assert.deepEqual(ids({ to: '2022-01-30' }), [1004, 1001]);
});
