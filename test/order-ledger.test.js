const test = require('node:test');
const assert = require('node:assert/strict');

const orders = require('../lib/orders');
const ledger = require('../lib/ledger');

test('orders sort newest-first by calendar date across month and year boundaries', () => {
  const db = {
    orders: [
      { id: 1001, date: '28/12/2021' },
      { id: 1002, date: '05/01/2022' },
      { id: 1008, date: '15/03/2022' },
      { id: 1007, date: '04/03/2022' }
    ]
  };

  assert.deepEqual(
    orders.list(db, {}).map(function (order) { return order.id; }),
    [1008, 1007, 1002, 1001]
  );
});

test('date range filter includes only dates within the requested calendar range', () => {
  const db = {
    orders: [
      { id: 1001, date: '28/12/2021' },
      { id: 1002, date: '05/01/2022' },
      { id: 1008, date: '15/03/2022' }
    ]
  };

  assert.deepEqual(
    orders.list(db, { from: '2022-01-01', to: '2022-01-31' }).map(function (order) { return order.id; }),
    [1002]
  );
});

test('string settlement amount updates totals numerically and computes the correct balance', () => {
  const customer = {
    id: 1,
    name: 'Meera Joshi',
    openingBalance: 450,
    totalBilled: 1982.01,
    totalSettled: 1200
  };
  const db = { customers: [customer], settlements: [], nextSettlementId: 501 };

  const result = ledger.recordSettlement(db, 1, '500', 'upi', 'test payment');

  assert.equal(result.ok, true);
  assert.equal(customer.totalSettled, 1700);
  assert.equal(customer.balance, 732.01);
  assert.equal(typeof customer.totalSettled, 'number');
  assert.equal(typeof db.settlements[0].amount, 'number');
});
