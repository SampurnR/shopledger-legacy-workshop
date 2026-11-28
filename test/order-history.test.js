const assert = require('node:assert/strict');
const test = require('node:test');
const orders = require('../lib/orders');

function orderHistory() {
  return {
    orders: [
      { id: 1001, date: '28/12/2021' },
      { id: 1004, date: '30/01/2022' },
      { id: 1008, date: '15/03/2022' }
    ]
  };
}

test('order history sorts newest first across months and years', () => {
  const results = orders.list(orderHistory());

  assert.deepEqual(results.map(order => order.id), [1008, 1004, 1001]);
});

test('orders on the same date appear in reverse insertion order', () => {
  const db = orderHistory();
  db.orders.push({ id: 1009, date: '15/03/2022' });

  const results = orders.list(db, { from: '2022-03-15', to: '2022-03-15' });

  assert.deepEqual(results.map(order => order.id), [1009, 1008]);
});

test('a January date range excludes orders from December and March', () => {
  const results = orders.list(orderHistory(), {
    from: '2022-01-01',
    to: '2022-01-31'
  });

  assert.deepEqual(results.map(order => order.id), [1004]);
});

test('a cross-month date range includes orders on both boundaries', () => {
  const results = orders.list(orderHistory(), {
    from: '2022-01-30',
    to: '2022-03-15'
  });

  assert.deepEqual(results.map(order => order.id), [1008, 1004]);
});
