var test = require('node:test');
var assert = require('node:assert/strict');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');
var helpers = require('./helpers');

test('REGRESSION: history sorts supported date formats chronologically without mutating records', function () {
  var db = helpers.createDb();
  db.orders = [
    { id: 1, date: '28/12/2021' },
    { id: 2, date: '05/01/2022' },
    { id: 3, date: '2022-02-02' },
    { id: 4, date: ' 30/01/2022 ' },
    { id: 5, date: '30/01/2022' }
  ];
  var before = helpers.clone(db);
  assert.deepEqual(orders.list(db).map(function (order) { return order.id; }), [3, 5, 4, 2, 1]);
  assert.deepEqual(db, before);
});

test('REGRESSION: same-day history lists newer order IDs first', function () {
  var db = helpers.createDb();
  db.orders = [
    { id: 1002, date: '05/01/2022' },
    { id: 1003, date: '05/01/2022' },
    { id: 1001, date: '05/01/2022' }
  ];
  assert.deepEqual(orders.list(db).map(function (order) { return order.id; }), [1003, 1002, 1001]);
});

test('REGRESSION: date range includes both endpoints across a year boundary', function () {
  var db = helpers.createDb();
  db.orders = [
    { id: 1, date: '28/12/2021' },
    { id: 2, date: '05/01/2022' },
    { id: 3, date: '06/01/2022' }
  ];
  assert.deepEqual(orders.list(db, { from: '2021-12-28', to: '2022-01-05' })
    .map(function (order) { return order.id; }), [2, 1]);
});

test('REGRESSION: UI string settlement adds numerically and reduces the balance', function () {
  var db = helpers.createDb();
  var result = ledger.recordSettlement(db, 1, '50');
  assert.equal(result.ok, true);
  assert.equal(db.customers[0].totalSettled, 150);
  assert.equal(db.customers[0].balance, 400);
  assert.equal(result.settlement.amount, 50);
});

test('REGRESSION: a numeric-string existing settled total is added numerically', function () {
  var db = helpers.createDb();
  db.customers[0].totalSettled = '100';
  assert.equal(ledger.recordSettlement(db, 1, '50').ok, true);
  assert.equal(db.customers[0].totalSettled, 150);
  assert.equal(db.customers[0].balance, 400);
});

test('REGRESSION: nonnumeric and nonfinite settlement amounts are rejected without mutation', function () {
  ['oops', 'NaN', 'Infinity', Infinity, NaN, -Infinity].forEach(function (amount) {
    var db = helpers.createDb();
    var before = helpers.clone(db);
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false, 'Reject amount: ' + String(amount));
    assert.deepEqual(db, before);
  });
});
