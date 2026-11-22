const test = require('node:test');
const assert = require('node:assert/strict');

const orders = require('../lib/orders');

function sampleDb() {
  return {
    orders: [
      { id: 1001, date: '28/12/2021' },
      { id: 1002, date: '05/01/2022' },
      { id: 1003, date: '14/01/2022' },
      { id: 1004, date: '30/01/2022' },
      { id: 1007, date: '04/03/2022' },
      { id: 1008, date: '15/03/2022' }
    ]
  };
}

test('lists orders in newest-first chronological order', () => {
  const listed = orders.list(sampleDb());

  assert.deepEqual(listed.map(order => order.id), [1008, 1007, 1004, 1003, 1002, 1001]);
});

test('filters ISO date-picker range by calendar date', () => {
  const listed = orders.list(sampleDb(), { from: '2022-01-01', to: '2022-01-31' });

  assert.deepEqual(listed.map(order => order.id), [1004, 1003, 1002]);
});
