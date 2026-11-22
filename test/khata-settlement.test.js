const assert = require('node:assert/strict');
const test = require('node:test');
const ledger = require('../lib/ledger');

function customerDb() {
  return {
    customers: [{
      id: 1, name: 'Meera Joshi', openingBalance: 450,
      totalBilled: 1982.01, totalSettled: 1200
    }],
    nextSettlementId: 501
  };
}

test('a settlement from the form updates the numeric totals and displayed balance', () => {
  const db = customerDb();
  assert.equal(ledger.listCustomers(db)[0].balance, 1232.01);
  const result = ledger.recordSettlement(db, 1, '500', 'upi');
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
  assert.equal(ledger.listCustomers(db)[0].balance, 732.01);
});

test('rejects invalid settlement amounts without changing the ledger', () => {
  const db = customerDb();
  const before = customerDb();

  for (const amount of ['invalid', 'Infinity', '0', '-5', true]) {
    assert.equal(ledger.recordSettlement(db, 1, amount, 'upi').ok, false);
  }
  assert.deepEqual(db, before);
});
