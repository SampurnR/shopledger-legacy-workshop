var test = require('node:test');
var assert = require('node:assert/strict');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');

// In-memory fixtures only; these tests never load the store or start a server.
function history() {
  return { orders: [
    { id: 1, date: '31/12/2025' },
    { id: 2, date: '01/01/2026' },
    { id: 3, date: '15/01/2026' },
    { id: 4, date: '02/02/2026' }
  ] };
}

function account() {
  return { customers: [{ id: 1, openingBalance: 100, totalBilled: 900,
    totalSettled: 100, balance: 900 }], settlements: [], nextSettlementId: 501 };
}

test('REGRESSION: history is newest first across months and years', function () {
  assert.deepEqual(orders.list(history()).map(function (o) { return o.id; }), [4, 3, 2, 1]);
});

test('REGRESSION: date range includes both endpoints across a month boundary', function () {
  var result = orders.list(history(), { from: '2026-01-15', to: '2026-02-02' });
  assert.deepEqual(result.map(function (o) { return o.id; }), [4, 3]);
});

test('REGRESSION: same dates retain their input order across stored date formats', function () {
  var db = { orders: [{ id: 1, date: '02/02/2026' },
    { id: 2, date: '2026-02-02' }, { id: 3, date: '02/02/2026' }] };
  assert.deepEqual(orders.list(db).map(function (o) { return o.id; }), [1, 2, 3]);
});

test('REGRESSION: UI string settlement reduces balance and stores numeric totals', function () {
  var db = account();
  var result = ledger.recordSettlement(db, 1, '50');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 150);
  assert.equal(result.customer.balance, 850);
  assert.equal(result.settlement.amount, 50);
  assert.equal(ledger.listCustomers(db)[0].balance, 850);
});

test('REGRESSION: existing numeric string totals accumulate numerically', function () {
  var db = account();
  db.customers[0].totalSettled = '100';
  var result = ledger.recordSettlement(db, 1, '50.25');
  assert.equal(result.customer.totalSettled, 150.25);
  assert.equal(result.customer.balance, 849.75);
});

test('REGRESSION: invalid settlement amounts are rejected without mutation', function () {
  ['abc', Infinity, -Infinity, 'Infinity', true, [], [50], {}].forEach(function (amount) {
    var db = account();
    var before = JSON.parse(JSON.stringify(db));
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false);
    assert.deepEqual(db, before);
  });
});
