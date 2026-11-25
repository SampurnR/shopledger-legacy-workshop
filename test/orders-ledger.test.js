var test = require('node:test');
var assert = require('node:assert');

var orders = require('../lib/orders');
var dates = require('../lib/dates');
var ledger = require('../lib/ledger');

function makeOrdersDb() {
  return {
    orders: [
      { id: 1, date: '15/03/2022' },
      { id: 2, date: '30/01/2022' },
      { id: 3, date: '28/12/2021' }
    ]
  };
}

function makeLedgerDb() {
  return {
    nextSettlementId: 501,
    settlements: [],
    customers: [{
      id: 7,
      name: 'Meera',
      openingBalance: 0,
      totalBilled: 2432.01,
      totalSettled: 1200,
      balance: 1232.01
    }]
  };
}

test('CURRENT BEHAVIOUR: orders.list sorts mixed dates newest first', function () {
  var result = orders.list(makeOrdersDb());

  assert.deepStrictEqual(result.map(function (order) { return order.id; }), [1, 2, 3]);
});

test('CURRENT BEHAVIOUR: orders.list from filter uses chronological YYYY-MM-DD boundary', function () {
  var result = orders.list(makeOrdersDb(), { from: '2022-02-01' });

  assert.deepStrictEqual(result.map(function (order) { return order.id; }), [1]);
});

test('CURRENT BEHAVIOUR: orders.list to filter uses chronological YYYY-MM-DD boundary', function () {
  var result = orders.list(makeOrdersDb(), { to: '2022-02-01' });

  assert.deepStrictEqual(result.map(function (order) { return order.id; }), [2, 3]);
});

test('CURRENT BEHAVIOUR: dates.normalizeDateKey returns sortable ISO keys', function () {
  assert.strictEqual(dates.normalizeDateKey('2022-03-15'), '2022-03-15');
  assert.strictEqual(dates.normalizeDateKey('30/01/2022'), '2022-01-30');
  assert.strictEqual(dates.normalizeDateKey(''), '');
});

test('CURRENT BEHAVIOUR: ledger.recordSettlement adds numeric amount and recalculates balance', function () {
  var db = makeLedgerDb();
  var result = ledger.recordSettlement(db, 7, 500, 'cash', 'cash payment');

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.customer.totalSettled, 1700);
  assert.strictEqual(result.customer.balance, 732.01);
  assert.strictEqual(result.settlement.amount, 500);
  assert.strictEqual(db.settlements.length, 1);
});

test('CURRENT BEHAVIOUR: ledger.recordSettlement adds numeric string amount numerically', function () {
  var db = makeLedgerDb();
  var result = ledger.recordSettlement(db, 7, '500', 'upi', 'JSON string amount');

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.customer.totalSettled, 1700);
  assert.strictEqual(result.customer.balance, 732.01);
  assert.strictEqual(result.settlement.amount, 500);
});

test('CURRENT BEHAVIOUR: ledger.recordSettlement rejects a zero amount without changing totals', function () {
  var db = makeLedgerDb();
  var result = ledger.recordSettlement(db, 7, 0);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error, 'Settlement amount must be greater than zero');
  assert.strictEqual(db.customers[0].totalSettled, 1200);
  assert.strictEqual(db.settlements.length, 0);
});

test('CURRENT BEHAVIOUR: ledger.recordSettlement rejects a negative amount without changing totals', function () {
  var db = makeLedgerDb();
  var result = ledger.recordSettlement(db, 7, -25);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error, 'Settlement amount must be greater than zero');
  assert.strictEqual(db.customers[0].totalSettled, 1200);
  assert.strictEqual(db.settlements.length, 0);
});

test('CURRENT BEHAVIOUR: ledger.recordSettlement rejects non-numeric text without changing totals', function () {
  var db = makeLedgerDb();
  var result = ledger.recordSettlement(db, 7, 'not-a-number');

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error, 'Settlement amount must be greater than zero');
  assert.strictEqual(db.customers[0].totalSettled, 1200);
  assert.strictEqual(db.customers[0].balance, 1232.01);
  assert.strictEqual(db.settlements.length, 0);
});

test('FIXED BEHAVIOUR: order history uses real dates and settlements validate numeric amounts', function () {
  var orderDb = makeOrdersDb();
  var ledgerDb = makeLedgerDb();
  var settlement = ledger.recordSettlement(ledgerDb, 7, '500', 'upi', 'JSON string amount');

  assert.deepStrictEqual(orders.list(orderDb).map(function (order) { return order.id; }), [1, 2, 3]);
  assert.deepStrictEqual(
    orders.list(makeOrdersDb(), { from: '2022-02-01' }).map(function (order) { return order.id; }),
    [1]
  );
  assert.deepStrictEqual(
    orders.list(makeOrdersDb(), { to: '2022-02-01' }).map(function (order) { return order.id; }),
    [2, 3]
  );
  assert.strictEqual(dates.normalizeDateKey('2022-03-15'), '2022-03-15');
  assert.strictEqual(dates.normalizeDateKey('15/03/2022'), '2022-03-15');
  assert.strictEqual(dates.getFiscalYear('15/03/2022'), 'FY21-22');
  assert.strictEqual(dates.getFiscalYear('01/04/2022'), 'FY22-23');
  assert.strictEqual(settlement.ok, true);
  assert.strictEqual(settlement.customer.name, 'Meera');
  assert.strictEqual(settlement.customer.totalSettled, 1700);
  assert.strictEqual(settlement.customer.balance, 732.01);

  [0, -25, 'not-a-number', '', null, true].forEach(function (amount) {
    var invalidDb = makeLedgerDb();
    var rejected = ledger.recordSettlement(invalidDb, 7, amount);
    assert.strictEqual(rejected.ok, false);
    assert.strictEqual(invalidDb.customers[0].totalSettled, 1200);
    assert.strictEqual(invalidDb.customers[0].balance, 1232.01);
    assert.strictEqual(invalidDb.settlements.length, 0);
  });
});
