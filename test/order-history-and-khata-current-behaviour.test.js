var test = require('node:test');
var assert = require('node:assert/strict');

var orders = require('../lib/orders');
var ledger = require('../lib/ledger');

test('CORRECT BEHAVIOUR: order history sorts newest date first', function () {
  var db = {
    orders: [
      { id: 1001, date: '28/12/2021' },
      { id: 1004, date: '30/01/2022' },
      { id: 1007, date: '04/03/2022' },
      { id: 1008, date: '15/03/2022' }
    ]
  };

  var result = orders.list(db);

  assert.deepEqual(result.map(function (order) { return order.id; }), [1008, 1007, 1004, 1001]);
});

test('CORRECT BEHAVIOUR: YYYY-MM-DD date range includes only dates in that range', function () {
  var db = {
    orders: [
      { id: 1001, date: '28/12/2021' },
      { id: 1004, date: '30/01/2022' },
      { id: 1007, date: '04/03/2022' },
      { id: 1008, date: '15/03/2022' }
    ]
  };

  var result = orders.list(db, { from: '2022-01-01', to: '2022-01-31' });

  assert.deepEqual(result.map(function (order) { return order.id; }), [1004]);
});

test('CORRECT BEHAVIOUR: string settlement amounts are added numerically', function () {
  var db = {
    nextSettlementId: 505,
    customers: [{
      id: 1,
      name: 'Meera Joshi',
      openingBalance: 450,
      totalBilled: 1982.01,
      totalSettled: 1200
    }],
    settlements: []
  };

  var result = ledger.recordSettlement(db, 1, '500', 'cash', 'Part payment');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
  assert.equal(db.settlements.length, 1);
});
