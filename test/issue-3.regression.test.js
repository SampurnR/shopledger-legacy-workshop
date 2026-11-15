var test = require('node:test');
var assert = require('node:assert/strict');
var dates = require('../lib/dates');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');

// Independent fixtures: do not load or write data/db.json.
function orderFixture() {
  return { orders: [
    { id: 1001, date: '28/12/2021', customer: 'Meera', paymentMode: 'khata' },
    { id: 1004, date: '30/01/2022', customer: 'Wholesale', status: 'completed', coupon: 'SAVE10' },
    { id: 1007, date: '04/03/2022', customer: 'Suresh', status: 'pending' },
    { id: 1008, date: '15/03/2022', customer: 'Walk-in', status: 'completed' }
  ] };
}

function ledgerFixture() {
  return {
    nextSettlementId: 505,
    customers: [{ id: 1, name: 'Meera Joshi', openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200, balance: 1232.01 }],
    settlements: [{ id: 504, amount: 100 }]
  };
}

function ids(list) {
  return list.map(function (order) { return order.id; });
}

function settle(db, amount) {
  var originalToday = dates.today;
  dates.today = function () { return '15/11/2026'; };
  try {
    return ledger.recordSettlement(db, 1, amount, 'cash', 'Part payment');
  } finally {
    dates.today = originalToday;
  }
}

test('date-picker input normalizes to stored display format', function () {
  assert.equal(dates.normalizeDateKey('2022-01-31'), '31/01/2022');
  assert.equal(dates.normalizeDateKey(' 31/01/2022 '), '31/01/2022');
  assert.equal(dates.normalizeDateKey(''), '');
});

test('fiscal year uses the April boundary for both date formats', function () {
  assert.equal(dates.getFiscalYear('31/03/2022'), 'FY21-22');
  assert.equal(dates.getFiscalYear('2022-04-01'), 'FY22-23');
});

test('history sorts newest first across month and year boundaries', function () {
  var db = orderFixture();
  var before = JSON.stringify(db);
  assert.deepEqual(ids(orders.list(db)), [1008, 1007, 1004, 1001]);
  assert.equal(JSON.stringify(db), before);
});

test('January date range excludes December and March orders', function () {
  assert.deepEqual(ids(orders.list(orderFixture(), { from: '2022-01-01', to: '2022-01-31' })), [1004]);
});

test('date filters include exact boundaries and accept either format', function () {
  ['2022-01-30', '30/01/2022'].forEach(function (date) {
    assert.deepEqual(ids(orders.list(orderFixture(), { from: date, to: date })), [1004]);
  });
});

test('one-sided date filters work across years and mixed date formats', function () {
  var db = orderFixture();
  db.orders[2].date = '2022-03-04';
  assert.deepEqual(ids(orders.list(db, { from: '2022-01-01' })), [1008, 1007, 1004]);
  assert.deepEqual(ids(orders.list(db, { to: '2022-01-31' })), [1004, 1001]);
});

test('status and case-insensitive search filters compose', function () {
  assert.deepEqual(ids(orders.list(orderFixture(), { status: 'pending', search: ' SURESH ' })), [1007]);
  assert.deepEqual(ids(orders.list(orderFixture(), { search: 'save10' })), [1004]);
  assert.deepEqual(ids(orders.list(orderFixture(), { search: '1008' })), [1008]);
  assert.deepEqual(ids(orders.list(orderFixture(), { status: 'completed', search: 'meera' })), [1001]);
  assert.deepEqual(orders.list({ orders: [] }), []);
});

test('numeric settlement updates balance, prepends receipt and increments counter', function () {
  var db = ledgerFixture();
  var result = settle(db, 500);
  assert.equal(result.ok, true);
  assert.equal(result.customer, db.customers[0]);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.deepEqual(result.settlement, {
    id: 505, customerId: 1, customerName: 'Meera Joshi', date: '15/11/2026',
    amount: 500, mode: 'cash', note: 'Part payment'
  });
  assert.equal(db.nextSettlementId, 506);
  assert.equal(db.settlements[0], result.settlement);
  assert.equal(db.settlements[1].id, 504);
});

test('UI string settlement adds numerically and reconciles customer balance', function () {
  var db = ledgerFixture();
  var result = settle(db, '500');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
  assert.equal(ledger.listCustomers(db)[0].balance, 732.01);
});

test('repeated string payments accumulate numerically', function () {
  var db = ledgerFixture();
  settle(db, '500');
  settle(db, '100');
  assert.equal(db.customers[0].totalSettled, 1800);
  assert.equal(db.customers[0].balance, 632.01);
  assert.equal(db.settlements[0].amount, 100);
  assert.equal(db.nextSettlementId, 507);
});

test('decimal payments round totals and accept a numeric string ledger total', function () {
  var db = ledgerFixture();
  db.customers[0].totalSettled = '1200';
  settle(db, '0.10');
  var result = settle(db, '0.20');
  assert.equal(result.customer.totalSettled, 1200.3);
  assert.equal(result.customer.balance, 1231.71);
  assert.equal(result.settlement.amount, 0.2);
});

test('zero, negative and empty amounts reject without mutations', function () {
  [0, -5, '', '0', '-5', null, undefined].forEach(function (amount) {
    var db = ledgerFixture();
    var before = JSON.stringify(db);
    assert.deepEqual(settle(db, amount), { ok: false, error: 'Settlement amount must be greater than zero' });
    assert.equal(JSON.stringify(db), before);
  });
});

test('missing customer rejects without mutations', function () {
  var db = ledgerFixture();
  var before = JSON.stringify(db);
  assert.deepEqual(ledger.recordSettlement(db, 999, 500), { ok: false, error: 'Customer not found' });
  assert.equal(JSON.stringify(db), before);
});

test('nonnumeric settlement rejects without mutations', function () {
  ['invalid', 'Infinity', Infinity, NaN, true, [], {}].forEach(function (amount) {
    var db = ledgerFixture();
    var before = JSON.stringify(db);
    var result = settle(db, amount);
    assert.equal(result.ok, false);
    assert.equal(typeof result.error, 'string');
    assert.ok(result.error.length > 0);
    assert.equal(JSON.stringify(db), before);
  });
});
