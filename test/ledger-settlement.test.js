var test = require('node:test');
var assert = require('node:assert/strict');
var ledger = require('../lib/ledger');

function fixture() {
  return {
    nextSettlementId: 1, settlements: [], customers: [{
      id: 1, name: 'Test account', openingBalance: 450,
      totalBilled: 1982.01, totalSettled: 1200, balance: 1232.01
    }]
  };
}

test('REGRESSION: form string payment increases settled total numerically and reduces balance', function () {
  var db = fixture();
  var result = ledger.recordSettlement(db, 1, '500', 'cash', 'Test payment');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});

test('numeric payment updates the balance and creates a settlement receipt', function () {
  var db = fixture();
  var result = ledger.recordSettlement(db, 1, 500, 'cash', 'Test payment');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.id, 1);
  assert.equal(result.settlement.customerId, 1);
  assert.equal(result.settlement.mode, 'cash');
  assert.equal(result.settlement.note, 'Test payment');
  assert.equal(result.settlement.amount, 500);
  assert.equal(db.nextSettlementId, 2);
  assert.deepEqual(db.settlements, [result.settlement]);
});

test('zero, negative and missing payments are rejected without mutation', function () {
  [0, -1, '', null, undefined].forEach(function (amount) {
    var db = fixture();
    var before = JSON.stringify(db);
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false);
    assert.equal(JSON.stringify(db), before);
  });
});

test('unknown customer cannot create a settlement', function () {
  var db = fixture();
  var before = JSON.stringify(db);
  assert.deepEqual(ledger.recordSettlement(db, 99, 500), { ok: false, error: 'Customer not found' });
  assert.equal(JSON.stringify(db), before);
});

test('REGRESSION: malformed and non-finite payments are rejected without mutation', function () {
  ['abc', '500abc', 'Infinity', Infinity, NaN, true, [], [500], {}, '   '].forEach(function (amount) {
    var db = fixture();
    var before = JSON.stringify(db);
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false, 'Invalid amount: ' + String(amount));
    assert.equal(JSON.stringify(db), before);
  });
});

test('REGRESSION: repeated decimal settlements keep totals and receipts numeric', function () {
  var db = fixture();
  db.customers[0].totalSettled = 0;
  ledger.recordSettlement(db, 1, '0.10');
  var result = ledger.recordSettlement(db, 1, '0.20');
  assert.equal(result.customer.totalSettled, 0.3);
  assert.equal(result.customer.balance, 2431.71);
  assert.deepEqual(db.settlements.map(function (entry) { return entry.amount; }), [0.2, 0.1]);
});

test('REGRESSION: existing numeric-string settled total is added numerically', function () {
  var db = fixture();
  db.customers[0].totalSettled = '1200';
  var result = ledger.recordSettlement(db, 1, '500.50');
  assert.equal(result.customer.totalSettled, 1700.5);
  assert.equal(result.customer.balance, 731.51);
  assert.equal(result.settlement.amount, 500.5);
});
