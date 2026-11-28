'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var ledger = require('../lib/ledger');

function database(totalSettled, totalBilled) {
  return {
    nextSettlementId: 501,
    settlements: [],
    customers: [{
      id: 7,
      name: 'In-memory customer',
      openingBalance: 0,
      totalBilled: totalBilled,
      totalSettled: totalSettled,
      balance: totalBilled - totalSettled
    }]
  };
}

test('string settlement amounts are added numerically without corrupting the customer balance', function () {
  var db = database(100, 200);

  var result = ledger.recordSettlement(db, 7, '25', 'upi', 'test');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 125);
  assert.equal(result.customer.balance, 75);
  assert.equal(result.settlement.amount, 25);
});

test('settlement larger than outstanding balance is rejected without changing the account', function () {
  var db = database(0, 40);

  var result = ledger.recordSettlement(db, 7, 500, 'cash', 'overpayment');

  assert.equal(result.ok, false);
  assert.equal(result.error, 'Settlement amount exceeds outstanding balance');
  assert.equal(result.customer, undefined);
  assert.equal(db.customers[0].totalSettled, 0);
  assert.equal(db.customers[0].balance, 40);
  assert.equal(db.settlements.length, 0);
});
