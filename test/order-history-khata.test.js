const test = require('node:test');
const assert = require('node:assert/strict');

const orders = require('../lib/orders');
const ledger = require('../lib/ledger');

test('order history sorts DD/MM/YYYY dates newest first', function () {
  const db = {
    orders: [
      { id: 1008, date: '15/03/2022' },
      { id: 1001, date: '28/12/2021' },
      { id: 1004, date: '30/01/2022' }
    ]
  };

  assert.deepEqual(orders.list(db, {}).map(function (order) { return order.id; }), [1008, 1004, 1001]);
});

test('date range filtering includes only dates within the requested calendar range', function () {
  const db = {
    orders: [
      { id: 1008, date: '15/03/2022' },
      { id: 1001, date: '28/12/2021' },
      { id: 1004, date: '30/01/2022' }
    ]
  };

  assert.deepEqual(
    orders.list(db, { from: '2022-01-01', to: '2022-02-01' }).map(function (order) { return order.id; }),
    [1004]
  );
});

test('string settlement amounts are added numerically to the customer balance', function () {
  const db = {
    customers: [{
      id: 1,
      name: 'Meera Joshi',
      openingBalance: 0,
      totalBilled: 142432.01,
      totalSettled: 71200,
      creditLimit: 200000
    }],
    nextSettlementId: 501,
    settlements: []
  };

  const result = ledger.recordSettlement(db, 1, '7500', 'upi', 'Month-end payment');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 78700);
  assert.equal(result.customer.balance, 63732.01);
  assert.equal(result.settlement.amount, 7500);
});
