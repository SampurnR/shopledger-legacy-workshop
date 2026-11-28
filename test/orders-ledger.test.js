var test = require('node:test');
var assert = require('node:assert/strict');
var orders = require('../lib/orders');
var dates = require('../lib/dates');
var ledger = require('../lib/ledger');

test('orders sort chronologically and filter inclusive date boundaries', function () {
  var db = { orders: [
    { id: 1004, date: '30/01/2022' },
    { id: 1001, date: '28/12/2021' },
    { id: 1008, date: '15/03/2022' }
  ] };
  assert.deepEqual(orders.list(db, {}).map(function (o) { return o.id; }), [1008, 1004, 1001]);
  assert.deepEqual(orders.list(db, { from: '2022-01-30', to: '2022-03-15' }).map(function (o) { return o.id; }), [1008, 1004]);
  assert.equal(dates.getFiscalYear('15/03/2022'), 'FY21-22');
  assert.equal(dates.getFiscalYear('2022-04-01'), 'FY22-23');
});

test('string settlement amounts update numeric totals and balance', function () {
  var db = { nextSettlementId: 1, customers: [{ id: 1, name: 'Meera Joshi', openingBalance: 0, totalBilled: 2432.01, totalSettled: 1200 }] };
  var result = ledger.recordSettlement(db, 1, '500', 'upi', '');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
  assert.equal(ledger.listCustomers(db)[0].balance, 732.01);
});

test('invalid settlement amounts leave the ledger unchanged', function () {
  var db = { nextSettlementId: 1, customers: [{ id: 1, totalSettled: 1200 }] };
  ['abc', 'Infinity', '0', '-1', '1.001'].forEach(function (amount) {
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false);
  });
  assert.equal(db.customers[0].totalSettled, 1200);
  assert.equal(db.nextSettlementId, 1);
});
