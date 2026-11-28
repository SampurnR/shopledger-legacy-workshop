const assert = require('node:assert/strict');
const test = require('node:test');
const ledger = require('../lib/ledger');

function customerLedger() {
  return {
    nextSettlementId: 1,
    customers: [{
      id: 1,
      name: 'Meera Joshi',
      openingBalance: 0,
      totalBilled: 2432.01,
      totalSettled: 1200,
      balance: 1232.01
    }],
    settlements: []
  };
}

test('a string settlement from the browser updates the running total numerically', () => {
  const db = customerLedger();
  const [before] = ledger.listCustomers(db);
  assert.equal(before.totalSettled, 1200);
  assert.equal(before.balance, 1232.01);

  const result = ledger.recordSettlement(db, '1', '500', 'upi');

  assert.equal(result.ok, true);
  assert.equal(result.settlement.amount, 500);
  assert.deepEqual(db.settlements, [result.settlement]);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);

  const [listed] = ledger.listCustomers(db);
  assert.equal(listed.totalSettled, 1700);
  assert.equal(listed.balance, 732.01);
});

test('a numeric settlement increases the settled total and reduces the balance', () => {
  const db = customerLedger();

  const result = ledger.recordSettlement(db, '1', 500, 'upi');

  assert.equal(result.ok, true);
  assert.equal(result.settlement.amount, 500);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);

  const [listed] = ledger.listCustomers(db);
  assert.equal(listed.totalSettled, 1700);
  assert.equal(listed.balance, 732.01);
});

test('a nonnumeric settlement is rejected without changing the ledger', () => {
  const db = customerLedger();

  const result = ledger.recordSettlement(db, '1', 'abc', 'upi');

  assert.equal(result.ok, false);
  assert.deepEqual(db, customerLedger());
});
