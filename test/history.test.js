var test = require('node:test');
var assert = require('node:assert/strict');

var ledger = require('../lib/ledger');
var reports = require('../lib/reports');

function database() {
  return {
    nextSettlementId: 501,
    products: [],
    orders: [],
    settlements: [],
    customers: [{
      id: 1,
      name: 'Meera Joshi',
      openingBalance: 0,
      totalBilled: 1000,
      totalSettled: 200,
      creditLimit: 5000
    }]
  };
}

test('CURRENT BEHAVIOUR: dashboard receivable is derived from customer ledger balances', function () {
  var summary = reports.getDashboardSummary(database());

  assert.equal(summary.totalKhataReceivable, 800);
});

test('a string settlement amount is recorded numerically in customer and settlement history', function () {
  var db = database();

  var result = ledger.recordSettlement(db, 1, '500', 'upi', 'Part payment');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 700);
  assert.equal(result.customer.balance, 300);
  assert.equal(result.settlement.amount, 500);
  assert.equal(db.settlements.length, 1);
});

test('dashboard receivable remains correct after a string settlement from the browser', function () {
  var db = database();

  ledger.recordSettlement(db, 1, '500', 'upi', 'Part payment');

  assert.equal(reports.getDashboardSummary(db).totalKhataReceivable, 300);
});

test('CURRENT BEHAVIOUR: non-positive settlements are rejected without adding history', function () {
  var db = database();

  assert.deepEqual(ledger.recordSettlement(db, 1, '0', 'cash', ''), {
    ok: false,
    error: 'Settlement amount must be greater than zero'
  });
  assert.equal(db.settlements.length, 0);
  assert.equal(db.customers[0].totalSettled, 200);
});

test('invalid settlement text is rejected without corrupting history', function () {
  var db = database();

  assert.deepEqual(ledger.recordSettlement(db, 1, 'not-a-number', 'cash', ''), {
    ok: false,
    error: 'Settlement amount must be greater than zero'
  });
  assert.equal(db.settlements.length, 0);
  assert.equal(db.customers[0].totalSettled, 200);
});

var orders = require('../lib/orders');

function orderHistory() {
  var dates = {
    1001: '28/12/2021', 1002: '05/01/2022', 1003: '14/01/2022', 1004: '30/01/2022',
    1005: '02/02/2022', 1006: '18/02/2022', 1007: '04/03/2022', 1008: '15/03/2022'
  };
  return {
    products: [],
    customers: [],
    orders: Object.keys(dates).map(function (id) {
      return { id: Number(id), date: dates[id], customer: 'Walk-in', status: 'completed', items: [] };
    })
  };
}

function ids(list) {
  return list.map(function (o) { return o.id; });
}

test('order history lists newest orders first across months and years', function () {
  assert.deepEqual(ids(orders.list(orderHistory(), {})),
    [1008, 1007, 1006, 1005, 1004, 1003, 1002, 1001]);
});

test('order history date filter from the date picker returns only orders in range', function () {
  var list = orders.list(orderHistory(), { from: '2022-01-01', to: '2022-01-31' });

  assert.deepEqual(ids(list), [1004, 1003, 1002]);
});

test('order history date filter treats from and to dates as inclusive', function () {
  var list = orders.list(orderHistory(), { from: '2021-12-28', to: '2022-01-05' });

  assert.deepEqual(ids(list), [1002, 1001]);
});

test('order history date filter also accepts DD/MM/YYYY input', function () {
  var list = orders.list(orderHistory(), { from: '01/03/2022' });

  assert.deepEqual(ids(list), [1008, 1007]);
});
