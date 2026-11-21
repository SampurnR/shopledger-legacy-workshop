var test = require('node:test');
var assert = require('node:assert/strict');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');

function sampleOrders() {
  return [
    { id: 1004, date: '30/01/2022' },
    { id: 1001, date: '28/12/2021' },
    { id: 1008, date: '15/03/2022' }
  ];
}

test('order history sorts and filters DD/MM/YYYY dates chronologically', function () {
  var db = { orders: sampleOrders() };

  assert.deepEqual(orders.list(db, {}).map(function (order) { return order.id; }), [1008, 1004, 1001]);
  assert.deepEqual(orders.list(db, { from: '2022-03-01', to: '2022-03-31' })
    .map(function (order) { return order.id; }), [1008]);
});

test('numeric-string settlement amounts update Khata totals arithmetically', function () {
  var db = {
    nextSettlementId: 1,
    customers: [{
      id: 1,
      name: 'Meera Joshi',
      openingBalance: 0,
      totalBilled: 2432.01,
      totalSettled: 1200
    }]
  };

  var result = ledger.recordSettlement(db, 1, '500', 'upi');

  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});
