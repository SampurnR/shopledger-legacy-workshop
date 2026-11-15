'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const orders = require('../lib/orders');
const ledger = require('../lib/ledger');

function makeOrderDb(orderDates) {
  return {
    orders: orderDates.map(function (entry) {
      return { id: entry.id, date: entry.date };
    })
  };
}

test('Order History sorts DD/MM/YYYY dates chronologically, newest first', function () {
  const db = makeOrderDb([
    { id: 1001, date: '28/12/2021' },
    { id: 1004, date: '30/01/2022' },
    { id: 1008, date: '15/03/2022' }
  ]);

  const result = orders.list(db, {});

  assert.deepEqual(result.map(function (order) { return order.id; }), [1008, 1004, 1001]);
});

test('a 2022 date range excludes orders from December 2021', function () {
  const db = makeOrderDb([
    { id: 1001, date: '28/12/2021' },
    { id: 1004, date: '30/01/2022' },
    { id: 1008, date: '15/03/2022' }
  ]);

  const result = orders.list(db, { from: '2022-01-01', to: '2022-03-31' });

  assert.deepEqual(result.map(function (order) { return order.id; }), [1008, 1004]);
});

test('numeric-string settlements add numerically and update the balance correctly', function () {
  const customer = {
    id: 1,
    name: 'Meera Joshi',
    openingBalance: 232.01,
    totalBilled: 2200,
    totalSettled: 1200
  };
  const db = {
    customers: [customer],
    settlements: [],
    nextSettlementId: 501
  };

  const result = ledger.recordSettlement(db, 1, '500', 'upi', 'Cash received');

  assert.equal(result.ok, true);
  assert.equal(customer.totalSettled, 1700);
  assert.equal(customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});
