'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');

function sampleOrders() {
  return [
    { id: 1001, date: '28/12/2021' },
    { id: 1002, date: '05/01/2022' },
    { id: 1003, date: '14/01/2022' },
    { id: 1004, date: '30/01/2022' },
    { id: 1005, date: '02/02/2022' },
    { id: 1006, date: '18/02/2022' },
    { id: 1007, date: '04/03/2022' },
    { id: 1008, date: '15/03/2022' }
  ];
}

function meeraLedger() {
  return {
    nextSettlementId: 505,
    customers: [{
      id: 1,
      name: 'Meera Joshi',
      phone: '98230 11420',
      openingBalance: 450,
      totalBilled: 1982.01,
      totalSettled: 1200,
      creditLimit: 5000
    }],
    settlements: []
  };
}

test('orders sort newest first by calendar date', function () {
  var list = orders.list({ orders: sampleOrders() }, {});

  assert.deepEqual(list.map(function (order) { return order.id; }), [1008, 1007, 1006, 1005, 1004, 1003, 1002, 1001]);
});

test('YYYY-MM-DD date range filter includes only January 2022 orders', function () {
  var list = orders.list({ orders: sampleOrders() }, {
    from: '2022-01-01',
    to: '2022-01-31'
  });
  var ids = list.map(function (order) { return order.id; });

  assert.deepEqual(ids, [1004, 1003, 1002]);
});

test('string settlement amount is converted before updating customer balance', function () {
  var db = meeraLedger();
  var result = ledger.recordSettlement(db, 1, '500', 'upi', 'Counter payment');

  assert.equal(result.ok, true);
  assert.equal(db.customers[0].totalSettled, 1700);
  assert.equal(db.customers[0].balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});
