var test = require('node:test');
var assert = require('node:assert/strict');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');

function orderFixture() {
  return {
    orders: [
      { id: 1001, date: '28/12/2021' },
      { id: 1004, date: '30/01/2022' },
      { id: 1008, date: '15/03/2022' }
    ]
  };
}

test('Order History returns orders newest first across calendar dates', function () {
  var result = orders.list(orderFixture());

  assert.deepEqual(result.map(function (order) { return order.id; }), [1008, 1004, 1001]);
});

test('Order History date range includes only orders within the selected calendar dates', function () {
  var result = orders.list(orderFixture(), {
    from: '2022-03-01',
    to: '2022-03-31'
  });

  assert.deepEqual(result.map(function (order) { return order.id; }), [1008]);
});

test('recording a string settlement amount updates the Khata balance numerically', function () {
  var db = {
    nextSettlementId: 501,
    customers: [{
      id: 7,
      name: 'Meera Joshi',
      openingBalance: 0,
      totalBilled: 2432.01,
      totalSettled: 1200
    }],
    settlements: []
  };

  var result = ledger.recordSettlement(db, 7, '500', 'upi', '');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});
