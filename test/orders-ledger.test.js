'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const orders = require('../lib/orders');
const ledger = require('../lib/ledger');

test('orders are sorted newest first across month and year boundaries', function () {
  const db = {
    orders: [
      { id: 1004, date: '30/01/2022' },
      { id: 1001, date: '28/12/2021' },
      { id: 1008, date: '15/03/2022' }
    ]
  };

  assert.deepEqual(orders.list(db).map(function (order) { return order.id; }), [1008, 1004, 1001]);
});

test('date range filtering compares dates chronologically and includes both endpoints', function () {
  const db = {
    orders: [
      { id: 1004, date: '30/01/2022' },
      { id: 1001, date: '28/12/2021' },
      { id: 1008, date: '15/03/2022' }
    ]
  };

  const rangeOrders = orders.list(db, { from: '2022-01-30', to: '2022-03-15' });
  assert.deepEqual(rangeOrders.map(function (order) { return order.id; }), [1008, 1004]);
});

test('string settlement amount is added numerically to customer totals', function () {
  const db = {
    nextSettlementId: 501,
    customers: [{
      id: 1,
      name: 'Meera Joshi',
      openingBalance: 0,
      totalBilled: 2432.01,
      totalSettled: 1200,
      creditLimit: 5000
    }],
    settlements: []
  };

  const result = ledger.recordSettlement(db, 1, '500', 'upi', 'Payment');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(ledger.listCustomers(db)[0].balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});

test('invalid settlement amounts are rejected without mutating customer balances', function () {
  const db = {
    nextSettlementId: 501,
    customers: [{
      id: 1,
      name: 'Meera Joshi',
      openingBalance: 0,
      totalBilled: 2432.01,
      totalSettled: 1200
    }],
    settlements: []
  };

  const invalid = ledger.recordSettlement(db, 1, 'not-a-number', 'upi', 'Bad input');

  assert.equal(invalid.ok, false);
  assert.equal(db.customers[0].totalSettled, 1200);
  assert.equal(db.customers[0].balance, undefined);
  assert.equal(db.settlements.length, 0);
  assert.equal(db.nextSettlementId, 501);
});
