const test = require('node:test');
const assert = require('node:assert/strict');
const orders = require('../lib/orders');

function order(id, date) {
  return { id, date, customer: 'Walk-in', status: 'completed' };
}

test('order history sorts newest dates first chronologically', () => {
  const db = {
    orders: [
      order(1008, '15/03/2022'),
      order(1004, '30/01/2022'),
      order(1001, '28/12/2021')
    ]
  };

  assert.deepEqual(orders.list(db).map((item) => item.id), [1008, 1004, 1001]);
});

test('date range includes only orders within the selected calendar dates', () => {
  const db = {
    orders: [
      order(1008, '15/03/2022'),
      order(1004, '30/01/2022'),
      order(1001, '28/12/2021')
    ]
  };

  const result = orders.list(db, { from: '2022-03-01', to: '2022-03-31' });
  assert.deepEqual(result.map((item) => item.id), [1008]);
});
