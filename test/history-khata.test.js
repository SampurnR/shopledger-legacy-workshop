var assert = require('node:assert/strict');
var test = require('node:test');
var dates = require('../lib/dates');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');

function orderHistory() {
  return { orders: [
    { id: 1001, date: '28/12/2021' },
    { id: 1004, date: '30/01/2022' },
    { id: 1005, date: '02/02/2022' },
    { id: 1008, date: '15/03/2022' },
    { id: 1009, date: '16/03/2022' }
  ] };
}

function orderIds(list) {
  return list.map(function (order) { return order.id; });
}

test('order history sorts newest first across months and years', function () {
  assert.deepEqual(orderIds(orders.list(orderHistory())), [1009, 1008, 1005, 1004, 1001]);
});

test('order history date filter includes both endpoints across months', function () {
  var filtered = orders.list(orderHistory(), { from: '2022-01-30', to: '2022-03-15' });
  assert.deepEqual(orderIds(filtered), [1008, 1005, 1004]);
  assert.deepEqual(orderIds(orders.list(orderHistory(), { from: '30/01/2022' })), [1009, 1008, 1005, 1004]);
  assert.deepEqual(orderIds(orders.list(orderHistory(), { to: '2022-01-30' })), [1004, 1001]);
});

test('orders on the same date sort by newest ID across both input formats', function () {
  var db = { orders: [{ id: 1009, date: '02/04/2022' }, { id: 1008, date: '2022-04-02' }] };
  assert.deepEqual(orderIds(orders.list(db)), [1009, 1008]);
});

test('fiscal year still changes at April in both supported date formats', function () {
  assert.equal(dates.getFiscalYear('31/03/2022'), 'FY21-22');
  assert.equal(dates.getFiscalYear('2022-04-01'), 'FY22-23');
});

test('a settlement from the form adds to Meera’s settled total and reduces her balance', function () {
  var db = {
    nextSettlementId: 501,
    customers: [{ id: 1, name: 'Meera Joshi', openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200 }]
  };
  assert.equal(ledger.listCustomers(db)[0].balance, 1232.01);

  var result = ledger.recordSettlement(db, 1, '500');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
  assert.deepEqual(db.settlements, [result.settlement]);
});

test('settlement adds decimal payments to a stored numeric string and rejects nonnumeric amounts', function () {
  var db = { nextSettlementId: 501, customers: [{ id: 1, totalBilled: 2000, totalSettled: '1200.10' }] };

  var result = ledger.recordSettlement(db, 1, 0.20);
  assert.equal(result.customer.totalSettled, 1200.30);
  assert.equal(result.customer.balance, 799.70);
  assert.equal(result.settlement.amount, 0.20);

  ['abc', Infinity, 0, -1, true].forEach(function (amount) {
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false);
  });
  assert.equal(db.customers[0].totalSettled, 1200.30);
  assert.equal(db.settlements.length, 1);
});
