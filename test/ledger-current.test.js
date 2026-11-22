var test = require('node:test');
var assert = require('node:assert/strict');
var ledger = require('../lib/ledger');

// Fresh in-memory fixtures; never import the JSON store or start the server.
function fixture() {
  return {
    customers: [{ id: 1, name: 'Test Customer', openingBalance: 100,
      totalBilled: 900, totalSettled: 100, balance: 900 }],
    settlements: [],
    nextSettlementId: 501
  };
}

test('CURRENT BEHAVIOUR: numeric settlement adds numerically and records a receipt', function () {
  var db = fixture();
  var result = ledger.recordSettlement(db, '1', 50, 'cash', 'Part payment');
  assert.equal(result.ok, true);
  assert.strictEqual(result.customer, db.customers[0]);
  assert.equal(result.customer.totalSettled, 150);
  assert.equal(result.customer.balance, 850);
  assert.strictEqual(db.settlements[0], result.settlement);
  assert.deepEqual(result.settlement, {
    id: 501, customerId: 1, customerName: 'Test Customer',
    date: result.settlement.date, amount: 50, mode: 'cash', note: 'Part payment'
  });
  assert.match(result.settlement.date, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.equal(db.nextSettlementId, 502);
});

test('REGRESSION: UI-style string amount adds numerically and receipt amount is numeric', function () {
  var db = fixture();
  var result = ledger.recordSettlement(db, 1, '50');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 150);
  assert.equal(result.customer.balance, 850);
  assert.equal(result.settlement.amount, 50);
  assert.equal(result.settlement.mode, 'upi');
  assert.equal(result.settlement.note, 'Khata settlement');
  assert.equal(ledger.listCustomers(db)[0].balance, 850);
});

test('REGRESSION: later numeric payments add correctly after a string payment', function () {
  var db = fixture();
  ledger.recordSettlement(db, 1, '50');
  var result = ledger.recordSettlement(db, 1, 25);
  assert.equal(result.customer.totalSettled, 175);
  assert.equal(result.customer.balance, 825);
  assert.deepEqual(db.settlements.map(function (s) { return s.id; }), [502, 501]);
  assert.deepEqual(db.settlements.map(function (s) { return s.amount; }), [25, 50]);
});

test('CURRENT BEHAVIOUR: missing customer is rejected without mutation', function () {
  var db = fixture();
  var before = JSON.parse(JSON.stringify(db));
  assert.deepEqual(ledger.recordSettlement(db, 999, 50), {
    ok: false, error: 'Customer not found'
  });
  assert.deepEqual(db, before);
});

test('CURRENT BEHAVIOUR: empty, zero, negative and NaN amounts are rejected without mutation', function () {
  [undefined, null, '', 0, '0', -1, '-1', NaN].forEach(function (amount) {
    var db = fixture();
    var before = JSON.parse(JSON.stringify(db));
    assert.deepEqual(ledger.recordSettlement(db, 1, amount), {
      ok: false, error: 'Settlement amount must be greater than zero'
    });
    assert.deepEqual(db, before);
  });
});

test('REGRESSION: nonnumeric strings and infinity are rejected without mutation', function () {
  ['abc', Infinity].forEach(function (amount) {
    var db = fixture();
    var before = JSON.parse(JSON.stringify(db));
    assert.deepEqual(ledger.recordSettlement(db, 1, amount), {
      ok: false, error: 'Settlement amount must be greater than zero'
    });
    assert.deepEqual(db, before);
  });
});

test('CURRENT BEHAVIOUR: payment above outstanding balance is accepted', function () {
  var result = ledger.recordSettlement(fixture(), 1, 1000);
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1100);
  assert.equal(result.customer.balance, -100);
});
