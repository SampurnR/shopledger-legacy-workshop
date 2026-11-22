const assert = require('node:assert/strict');
const test = require('node:test');
const orders = require('../lib/orders');

const db = {
  orders: [
    { id: 1001, date: '28/12/2021' },
    { id: 1002, date: '05/01/2022' },
    { id: 1003, date: '14/01/2022' },
    { id: 1004, date: '30/01/2022' },
    { id: 1007, date: '04/03/2022' },
    { id: 1008, date: '15/03/2022' },
    { id: 1009, date: '31/01/2022' },
    { id: 1010, date: '01/01/2022' }
  ]
};

test('order history sorts newest first across month and year boundaries', () => {
  assert.deepEqual(orders.list(db).map(order => order.id),
    [1008, 1007, 1009, 1004, 1003, 1002, 1010, 1001]);
});

test('January date range includes both endpoints and excludes other months', () => {
  const result = orders.list(db, { from: '2022-01-01', to: '2022-01-31' });
  assert.deepEqual(result.map(order => order.id),
    [1009, 1004, 1003, 1002, 1010]);
});
