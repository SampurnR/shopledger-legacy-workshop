const assert = require('node:assert/strict');
const { test } = require('node:test');
const dates = require('../lib/dates');
const ledger = require('../lib/ledger');

function makeDb() {
  return {
    customers: [{
      id: 7,
      name: 'Corner Shop',
      openingBalance: 100,
      totalBilled: 200,
      totalSettled: 25,
      balance: 275
    }],
    settlements: [],
    nextSettlementId: 501
  };
}

test('numeric Khata settlements update the balance and prepend entries with sequential IDs', (t) => {
  t.mock.method(dates, 'today', () => '15/06/2021');
  const db = makeDb();

  const first = ledger.recordSettlement(db, '7', 50.25, 'cash', 'Paid at counter');

  assert.equal(first.ok, true);
  assert.equal(first.customer, db.customers[0]);
  assert.equal(first.customer.totalSettled, 75.25);
  assert.equal(first.customer.balance, 224.75);
  assert.deepEqual(first.settlement, {
    id: 501,
    customerId: 7,
    customerName: 'Corner Shop',
    date: '15/06/2021',
    amount: 50.25,
    mode: 'cash',
    note: 'Paid at counter'
  });

  const second = ledger.recordSettlement(db, 7, 0.1);

  assert.equal(second.ok, true);
  assert.equal(second.customer.balance, 224.65);
  assert.equal(second.settlement.id, 502);
  assert.equal(second.settlement.mode, 'upi');
  assert.equal(second.settlement.note, 'Khata settlement');
  assert.deepEqual(db.settlements, [second.settlement, first.settlement]);
  assert.equal(db.nextSettlementId, 503);
  assert.equal(ledger.listCustomers(db)[0].balance, 224.65);
});

test('Khata rejects missing customers and nonpositive amounts without changing the ledger', () => {
  const db = makeDb();
  const before = structuredClone(db);

  assert.deepEqual(ledger.recordSettlement(db, 99, 50), {
    ok: false,
    error: 'Customer not found'
  });
  for (const amount of [undefined, '', 0, '0', -5, '-5']) {
    assert.deepEqual(ledger.recordSettlement(db, 7, amount), {
      ok: false,
      error: 'Settlement amount must be greater than zero'
    });
  }
  assert.deepEqual(db, before);
});

test('Khata adds browser amount strings as numeric payments', () => {
  const db = makeDb();

  const first = ledger.recordSettlement(db, '7', '50');

  assert.equal(first.ok, true);
  assert.equal(first.settlement.amount, 50);
  assert.equal(first.customer.totalSettled, 75);
  assert.equal(first.customer.balance, 225);

  const second = ledger.recordSettlement(db, '7', '10.50');

  assert.equal(second.ok, true);
  assert.equal(second.settlement.amount, 10.5);
  assert.equal(second.customer.totalSettled, 85.5);
  assert.equal(second.customer.balance, 214.5);
  assert.equal(ledger.listCustomers(db)[0].balance, 214.5);
});

test('Khata rejects invalid amounts without changing the ledger', () => {
  const db = makeDb();
  const before = structuredClone(db);

  for (const amount of ['abc', 'Infinity', Infinity, NaN, true, [50], '0.001', 10.005, '275.004']) {
    assert.equal(ledger.recordSettlement(db, 7, amount).ok, false);
    assert.deepEqual(db, before);
  }
});

test('Khata defaults a missing legacy settlement total to zero', () => {
  const db = makeDb();
  delete db.customers[0].totalSettled;

  const result = ledger.recordSettlement(db, 7, 50);

  assert.equal(result.ok, true);
  assert.equal(result.settlement.amount, 50);
  assert.equal(result.customer.totalSettled, 50);
  assert.equal(result.customer.balance, 250);
  assert.equal(ledger.listCustomers(db)[0].balance, 250);
});

test('Khata rejects a settlement above the outstanding balance without writing anything', () => {
  const db = makeDb();
  const before = structuredClone(db);

  assert.equal(ledger.recordSettlement(db, 7, 275.01).ok, false);
  assert.deepEqual(db, before);
});

test('Khata rejects a settlement when a corrupted total makes the balance invalid', () => {
  const db = makeDb();
  db.customers[0].totalSettled = '25abc';
  const before = structuredClone(db);

  assert.equal(ledger.recordSettlement(db, 7, 500).ok, false);
  assert.deepEqual(db, before);
});

test('Khata accepts an exact payoff after fractional payments', () => {
  const db = makeDb();

  assert.equal(ledger.recordSettlement(db, 7, '0.10').ok, true);
  const result = ledger.recordSettlement(db, 7, '274.90');
  assert.equal(result.ok, true);
  assert.equal(result.settlement.amount, 274.9);
  assert.equal(result.customer.totalSettled, 300);
  assert.equal(result.customer.balance, 0);
  assert.equal(ledger.listCustomers(db)[0].balance, 0);
});

test('Khata can pay off the displayed balance when a legacy total has fractional paise', () => {
  const db = makeDb();
  db.customers[0].totalSettled = 25.005;
  db.settlements.push({ id: 500, customerId: 7, amount: 25.005 });
  const due = ledger.listCustomers(db)[0].balance;

  const result = ledger.recordSettlement(db, 7, due);

  assert.equal(result.ok, true);
  assert.equal(result.settlement.amount, 275);
  assert.equal(result.customer.totalSettled, 300.005);
  assert.equal(result.customer.totalSettled, db.settlements.reduce((sum, entry) => sum + entry.amount, 0));
  assert.equal(result.customer.balance, 0);
  assert.equal(ledger.listCustomers(db)[0].balance, 0);
});
