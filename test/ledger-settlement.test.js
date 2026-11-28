const assert = require('node:assert/strict');
const { test } = require('node:test');

const ledger = require('../lib/ledger');

function makeAccount(totalSettled = 100) {
  return {
    customers: [{ id: 1, name: 'Test customer', totalBilled: 500, totalSettled }],
    nextSettlementId: 501,
    settlements: []
  };
}

test('records a numeric settlement and preserves the account and entry details', () => {
  const db = makeAccount();
  const result = ledger.recordSettlement(db, 1, 50, 'cash', 'Counter payment');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 150);
  assert.equal(result.customer.balance, 350);
  assert.deepEqual(db.settlements, [result.settlement]);
  assert.equal(result.settlement.id, 501);
  assert.equal(result.settlement.amount, 50);
  assert.equal(result.settlement.mode, 'cash');
  assert.equal(result.settlement.note, 'Counter payment');
  assert.equal(db.nextSettlementId, 502);
});

test('adds a browser settlement amount numerically and rounds the balance to paise', () => {
  const db = makeAccount('100.10');
  const result = ledger.recordSettlement(db, '1', '50.20');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 150.3);
  assert.equal(result.customer.balance, 349.7);
  assert.equal(result.settlement.amount, 50.2);
});

test('defaults a missing settled total to zero', () => {
  const db = makeAccount();
  delete db.customers[0].totalSettled;

  const result = ledger.recordSettlement(db, '1', '50');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 50);
  assert.equal(result.customer.balance, 450);
});

test('rejects invalid amounts without changing the account or creating a settlement', () => {
  for (const amount of ['abc', 'Infinity', Infinity, NaN, true, [50], ' ', 0, -1, 0.001]) {
    const db = makeAccount();

    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false, String(amount));
    assert.deepEqual(db, makeAccount());
  }
});
