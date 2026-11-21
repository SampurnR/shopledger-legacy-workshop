const assert = require('node:assert/strict');
const test = require('node:test');
const ledger = require('../lib/ledger');

function fixture() {
  return {
    customers: [{ id: 1, name: 'Meera Joshi', openingBalance: 450,
      totalBilled: 1982.01, totalSettled: 1200 }],
    settlements: [],
    nextSettlementId: 1
  };
}

test('adds the browser amount numerically and returns the updated balance', () => {
  const db = fixture();
  const result = ledger.recordSettlement(db, 1, '500');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(db.settlements[0].amount, 500);
  assert.equal(ledger.listCustomers(db)[0].balance, 732.01);
  assert.equal(ledger.recordSettlement(db, 1, 0.01).customer.totalSettled, 1700.01);
});

test('rejects invalid settlement amounts without mutating the ledger', () => {
  const db = fixture();
  for (const amount of ['', 'abc', 'Infinity', 0, -5, Infinity, true, [500]]) {
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false);
    assert.deepEqual(db, fixture());
  }
});
