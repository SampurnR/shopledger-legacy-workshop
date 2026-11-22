var assert = require('node:assert/strict');
var test = require('node:test');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');

function orderHistory(filters) {
  var db = {
    orders: [
      { id: 1001, date: '28/12/2021' },
      { id: 1004, date: '30/01/2022' },
      { id: 1008, date: '15/03/2022' }
    ]
  };

  return orders.list(db, filters).map(function (order) {
    return order.id;
  });
}

function khataAccount() {
  return {
    customers: [{
      id: 1,
      name: 'Meera Joshi',
      totalBilled: 2432.01,
      totalSettled: 1200
    }],
    settlements: [],
    nextSettlementId: 1
  };
}

test('order history sorts newest first across months and years', function () {
  assert.deepEqual(orderHistory(), [1008, 1004, 1001]);
});

test('filtering for March returns only March orders', function () {
  assert.deepEqual(orderHistory({ from: '2022-03-01', to: '2022-03-31' }), [1008]);
});

test('filtering across years includes both date boundaries in newest-first order', function () {
  assert.deepEqual(orderHistory({ from: '2021-12-28', to: '2022-03-15' }), [1008, 1004, 1001]);
});

test('a settlement amount from the form is added numerically to the settled total', function () {
  var db = khataAccount();
  assert.equal(ledger.listCustomers(db)[0].balance, 1232.01);

  var result = ledger.recordSettlement(db, '1', '500', 'upi');

  assert.equal(result.ok, true);
  assert.equal(result.settlement.amount, 500);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(ledger.listCustomers(db)[0].balance, 732.01);
});

test('a numeric settlement amount reduces the balance by the payment amount', function () {
  var db = khataAccount();
  var result = ledger.recordSettlement(db, '1', 500, 'upi');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
});
