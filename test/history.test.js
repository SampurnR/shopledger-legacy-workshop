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
