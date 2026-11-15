const assert = require('node:assert/strict');
const test = require('node:test');
const ledger = require('../lib/ledger');

function account(fields) {
  return {
    customers: [{ id: 1, name: 'Example Customer', openingBalance: 10, totalBilled: 490, ...fields }],
    settlements: [],
    nextSettlementId: 1
  };
}

test('Khata settlements add UI amounts numerically and persist the balance to cents', () => {
  const db = account({ totalSettled: 100.10 });
  assert.equal(ledger.recordSettlement(db, '1', '25.20').settlement.amount, 25.20);
  assert.equal(ledger.recordSettlement(db, 1, 0.10).settlement.amount, 0.10);
  assert.equal(db.customers[0].totalSettled, 125.40);
  assert.equal(db.customers[0].balance, 374.60);
  assert.equal(ledger.listCustomers(db)[0].balance, 374.60);
});

test('Khata settlements support missing totals and numeric strings in stored totals', () => {
  const empty = account();
  const legacy = account({ totalSettled: '100.00' });
  assert.equal(ledger.recordSettlement(empty, 1, 25).customer.totalSettled, 25);
  assert.equal(ledger.recordSettlement(legacy, 1, '25').customer.totalSettled, 125);
});

test('invalid Khata settlement amounts leave the customer and settlement records untouched', () => {
  for (const amount of ['', '0', '-1', 'abc', 'Infinity', Infinity, true, [25]]) {
    const db = account({ totalSettled: 100 });
    const before = structuredClone(db);
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false, String(amount));
    assert.deepEqual(db, before);
  }
});
