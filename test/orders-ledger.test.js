'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const orders = require('../lib/orders');
const dates = require('../lib/dates');
const ledger = require('../lib/ledger');

function orderDb() {
  return {
    orders: [
      { id: 1, date: '28/12/2021' },
      { id: 2, date: '30/01/2022' },
      { id: 3, date: '15/03/2022' }
    ]
  };
}

function ledgerDb() {
  return {
    customers: [{
      id: 1,
      name: 'Test Customer',
      openingBalance: 450,
      totalBilled: 1982.01,
      totalSettled: 1200,
      balance: 1232.01
    }],
    settlements: [],
    nextSettlementId: 501
  };
}

test('CURRENT BEHAVIOUR: orders.list sorts newest first by calendar date', function () {
  const result = orders.list(orderDb());
  assert.deepEqual(result.map(function (order) { return order.id; }), [3, 2, 1]);
});

test('CURRENT BEHAVIOUR: orders.list from filter uses calendar date for YYYY-MM-DD inputs', function () {
  const result = orders.list(orderDb(), { from: '2022-01-01' });
  assert.deepEqual(result.map(function (order) { return order.id; }), [3, 2]);
});

test('CURRENT BEHAVIOUR: orders.list to filter uses calendar date for YYYY-MM-DD inputs', function () {
  const result = orders.list(orderDb(), { to: '2022-02-01' });
  assert.deepEqual(result.map(function (order) { return order.id; }), [2, 1]);
});

test('CURRENT BEHAVIOUR: dates.normalizeDateKey returns sortable ISO date keys', function () {
  assert.equal(dates.normalizeDateKey('2022-03-15'), '2022-03-15');
  assert.equal(dates.normalizeDateKey(' 15/03/2022 '), '2022-03-15');
  assert.equal(dates.normalizeDateKey('2022-3'), '2022-3');
  assert.equal(dates.normalizeDateKey(''), '');
});

test('CURRENT BEHAVIOUR: ledger.recordSettlement adds a numeric amount arithmetically', function () {
  const db = ledgerDb();
  const result = ledger.recordSettlement(db, 1, 500, 'cash', 'part payment');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
  assert.equal(db.settlements.length, 1);
  assert.equal(db.nextSettlementId, 502);
});

test('CURRENT BEHAVIOUR: ledger.recordSettlement converts a string amount to a number', function () {
  const db = ledgerDb();
  const result = ledger.recordSettlement(db, 1, '500', 'upi', 'JSON string amount');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});

test('CURRENT BEHAVIOUR: ledger.recordSettlement rejects zero and negative amounts without mutation', function () {
  [0, -1].forEach(function (amount) {
    const db = ledgerDb();
    const result = ledger.recordSettlement(db, 1, amount);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Settlement amount must be greater than zero');
    assert.equal(db.customers[0].totalSettled, 1200);
    assert.equal(db.customers[0].balance, 1232.01);
    assert.equal(db.settlements.length, 0);
    assert.equal(db.nextSettlementId, 501);
  });
});

test('CURRENT BEHAVIOUR: ledger.recordSettlement rejects non-numeric text without mutation', function () {
  const db = ledgerDb();
  const result = ledger.recordSettlement(db, 1, 'not-a-number');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Settlement amount must be greater than zero');
  assert.equal(result.customer, undefined);
  assert.equal(db.customers[0].totalSettled, 1200);
  assert.equal(db.customers[0].balance, 1232.01);
  assert.equal(db.settlements.length, 0);
  assert.equal(db.nextSettlementId, 501);
});

test('CURRENT BEHAVIOUR: ticket expects chronological dates and validated numeric settlements', function () {
  const db = orderDb();
  assert.deepEqual(orders.list(db).map(function (order) { return order.id; }), [3, 2, 1]);
  assert.deepEqual(orders.list(db, { from: '2022-01-01' }).map(function (order) { return order.id; }), [3, 2]);
  assert.deepEqual(orders.list(db, { to: '2022-02-01' }).map(function (order) { return order.id; }), [2, 1]);
  assert.deepEqual(orders.list(db, { from: '2022-01-01', to: '2022-02-01' }).map(function (order) { return order.id; }), [2]);
  assert.equal(dates.normalizeDateKey('15/03/2022'), '2022-03-15');

  const settlementDb = ledgerDb();
  const result = ledger.recordSettlement(settlementDb, 1, '500', 'upi', 'part payment');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);

  [0, -1, 'not-a-number'].forEach(function (amount) {
    const invalidDb = ledgerDb();
    const invalid = ledger.recordSettlement(invalidDb, 1, amount);
    assert.equal(invalid.ok, false);
    assert.equal(invalidDb.customers[0].totalSettled, 1200);
    assert.equal(invalidDb.customers[0].balance, 1232.01);
    assert.equal(invalidDb.settlements.length, 0);
  });
});
