'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ledger = require('../lib/ledger');

function settled(creditLimit = 5000, strings = true) {
  const db = { nextSettlementId: 1, settlements: [], auditLog: [], customers: [{
    id: 1, name: 'Meera', openingBalance: strings ? '450' : 450,
    totalBilled: strings ? '1982.01' : 1982.01, totalSettled: strings ? '1200' : 1200, creditLimit
  }, { id: 2, name: 'Unrelated', openingBalance: 0, totalBilled: 10, totalSettled: 0, balance: 10 }] };
  assert.equal(ledger.recordSettlement(db, 1, '500').ok, true);
  assert.equal(db.customers[0].balance, 732.01);
  return db;
}
function assertBalances(db, billed, balance) {
  assert.equal(db.customers[0].totalBilled, billed);
  assert.equal(db.customers[0].balance, balance);
  assert.equal(ledger.listCustomers(db)[0].balance, balance);
}

test('settlement then valid charge below credit limit uses numeric historical totals', () => {
  const db = settled();
  assert.equal(ledger.chargeOrderToKhata(db, 1, 100).ok, true);
  assertBalances(db, 2082.01, 832.01);
});
test('settlement then unlimited charge updates billed and saved/listed balances', () => {
  const db = settled(0);
  assert.equal(ledger.chargeOrderToKhata(db, 1, '100').ok, true);
  assertBalances(db, 2082.01, 832.01);
});
test('settlement then reversal keeps saved/listed balances equal and preserves void return', () => {
  const db = settled();
  assert.equal(ledger.reverseOrderDebit(db, 1, '100'), undefined);
  assertBalances(db, 1882.01, 632.01);
});
test('credit limit is inclusive and over-limit charge leaves all state unchanged', () => {
  const db = settled('832.01');
  assert.equal(ledger.chargeOrderToKhata(db, 1, '100').ok, true);
  const before = structuredClone(db);
  const result = ledger.chargeOrderToKhata(db, 1, 0.01);
  assert.equal(result.ok, false);
  assert.match(result.error, /credit limit exceeded/);
  assert.deepEqual(db, before);
});
test('numeric and numeric-string decimal charge/reversal preserve entries and unrelated state', () => {
  for (const strings of [false, true]) {
    const db = settled(0, strings);
    const entries = structuredClone(db.settlements);
    const unrelated = structuredClone(db.customers[1]);
    assert.equal(ledger.chargeOrderToKhata(db, 1, '100.25').ok, true);
    assertBalances(db, 2082.26, 832.26);
    ledger.reverseOrderDebit(db, 1, 100.25);
    assertBalances(db, 1982.01, 732.01);
    assert.deepEqual(db.settlements, entries);
    assert.deepEqual(db.customers[1], unrelated);
    assert.deepEqual(db.auditLog, []);
  }
});
test('reversal preserves existing clamp at zero billed', () => {
  const db = settled();
  ledger.reverseOrderDebit(db, 1, 3000);
  assertBalances(db, 0, -1250);
});
test('invalid charge and reversal amounts do not mutate any customer state', () => {
  for (const value of [undefined, null, '', ' ', 'bad', -1, NaN, Infinity, true, {}, [], Number.MAX_SAFE_INTEGER]) {
    const db = settled(0);
    const before = structuredClone(db);
    assert.equal(ledger.chargeOrderToKhata(db, 1, value).ok, false, String(value));
    assert.deepEqual(db, before);
    assert.equal(ledger.reverseOrderDebit(db, 1, value), undefined);
    assert.deepEqual(db, before);
  }
});
test('malformed historical totals reject charges and leave reversals as nonmutating failures', () => {
  for (const key of ['openingBalance', 'totalBilled', 'totalSettled']) {
    for (const value of [null, '', ' ', 'bad', Infinity, true, {}, []]) {
      const db = settled(0);
      db.customers[0][key] = value;
      const before = structuredClone(db);
      assert.equal(ledger.chargeOrderToKhata(db, 1, 100).ok, false);
      assert.deepEqual(db, before);
      ledger.reverseOrderDebit(db, 1, 100);
      assert.deepEqual(db, before);
    }
  }
});
test('unsafe projected currency values fail before charge or reversal mutation', () => {
  const db = settled(0);
  Object.assign(db.customers[0], { openingBalance: 0, totalBilled: 90071992547400, totalSettled: 0 });
  const before = structuredClone(db);
  assert.equal(ledger.chargeOrderToKhata(db, 1, 100).ok, false);
  assert.deepEqual(db, before);
  Object.assign(db.customers[0], { openingBalance: -90071992547400, totalBilled: 90071992547400, totalSettled: 100 });
  const beforeReverse = structuredClone(db);
  ledger.reverseOrderDebit(db, 1, 90071992547400);
  assert.deepEqual(db, beforeReverse);
});
test('unknown customers preserve existing charge error and reversal void behavior', () => {
  const db = settled();
  const before = structuredClone(db);
  assert.deepEqual(ledger.chargeOrderToKhata(db, 99, 100), { ok: false, error: 'Customer account not found for Khata billing' });
  assert.equal(ledger.reverseOrderDebit(db, 99, 100), undefined);
  assert.deepEqual(db, before);
});
