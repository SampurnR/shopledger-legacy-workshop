'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const orders = require('../lib/orders');
const ledger = require('../lib/ledger');

function orderDb() {
  return {
    orders: [
      { id: 1001, date: '28/12/2021' },
      { id: 1004, date: '30/01/2022' },
      { id: 1008, date: '15/03/2022' }
    ]
  };
}

test('Order History lists newest orders first across year boundaries', () => {
  const result = orders.list(orderDb(), { status: 'all' });

  assert.deepEqual(result.map(order => order.id), [1008, 1004, 1001]);
});

test('Order History applies ISO date range filters chronologically', () => {
  const result = orders.list(orderDb(), {
    status: 'all',
    from: '2022-02-01',
    to: '2022-03-31'
  });

  assert.deepEqual(result.map(order => order.id), [1008]);
});

test('Khata string settlement amount updates totals and balance numerically', () => {
  const customer = {
    id: 1,
    name: 'Meera Joshi',
    openingBalance: 450,
    totalBilled: 1982.01,
    totalSettled: 1200,
    balance: 1232.01
  };
  const db = {
    customers: [customer],
    settlements: [],
    nextSettlementId: 505
  };

  const result = ledger.recordSettlement(db, 1, '500', 'upi', 'characterization fixture');

  assert.equal(result.ok, true);
  assert.equal(result.settlement.amount, 500);
  assert.equal(customer.totalSettled, 1700);
  assert.equal(customer.balance, 732.01);
});
