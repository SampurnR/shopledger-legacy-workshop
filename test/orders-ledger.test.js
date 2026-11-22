'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const orders = require('../lib/orders');
const ledger = require('../lib/ledger');

function orderDb() {
  return {
    orders: [
      { id: 1001, date: '28/12/2021', status: 'completed' },
      { id: 1004, date: '30/01/2022', status: 'completed' },
      { id: 1008, date: '15/03/2022', status: 'completed' },
      { id: 1009, date: '01/04/2022', status: 'completed' }
    ]
  };
}

test('EXPECTED BEHAVIOUR: order history sorts newest dates first chronologically', function () {
  const result = orders.list(orderDb(), { status: 'all' });

  assert.deepEqual(result.map(function (order) { return order.id; }), [1009, 1008, 1004, 1001]);
});

test('EXPECTED BEHAVIOUR: ISO date filters include only orders within the selected calendar range', function () {
  const result = orders.list(orderDb(), { from: '2022-03-01', to: '2022-03-31' });

  assert.deepEqual(result.map(function (order) { return order.id; }), [1008]);
});

test('EXPECTED BEHAVIOUR: string settlement amounts update Khata totals arithmetically', function () {
  const customer = {
    id: 3,
    name: 'Meera Joshi',
    openingBalance: 0,
    totalBilled: 2432.01,
    totalSettled: 1200,
    creditLimit: 5000
  };
  const db = { customers: [customer], settlements: [], nextSettlementId: 501 };

  const result = ledger.recordSettlement(db, 3, '500', 'cash', 'Test payment');

  assert.equal(result.ok, true);
  assert.equal(customer.totalSettled, 1700);
  assert.equal(customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});
