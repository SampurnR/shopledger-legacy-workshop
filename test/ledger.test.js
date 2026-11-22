const test = require('node:test');
const assert = require('node:assert/strict');

const ledger = require('../lib/ledger');

function sampleDb() {
  return {
    nextSettlementId: 505,
    customers: [{
      id: 1,
      name: 'Meera Joshi',
      openingBalance: 450,
      totalBilled: 1982.01,
      totalSettled: 1200,
      balance: 1232.01
    }],
    settlements: []
  };
}

test('adds a string settlement amount numerically to the customer balance', () => {
  const db = sampleDb();
  const result = ledger.recordSettlement(db, 1, '500', 'upi', 'Counter payment');

  assert.equal(result.ok, true);
  assert.equal(typeof result.customer.totalSettled, 'number');
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});

test('rejects a nonnumeric settlement without changing the ledger', () => {
  const db = sampleDb();
  const result = ledger.recordSettlement(db, 1, 'not-a-number', 'upi', 'Invalid input');

  assert.equal(result.ok, false);
  assert.equal(db.customers[0].totalSettled, 1200);
  assert.equal(db.customers[0].balance, 1232.01);
  assert.equal(db.settlements.length, 0);
  assert.equal(db.nextSettlementId, 505);
});
