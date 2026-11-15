const assert = require('node:assert/strict');
const test = require('node:test');
const dates = require('../lib/dates');
const ledger = require('../lib/ledger');

function settlementFixture() {
  const customer = {
    id: 7,
    name: 'Corner Market',
    openingBalance: 100,
    totalBilled: 600,
    totalSettled: 50,
    balance: 650
  };
  const db = { customers: [customer], nextSettlementId: 501 };
  return { db, customer };
}

test('numeric Khata settlements update the ledger and prepend numbered receipts', (t) => {
  t.mock.method(dates, 'today', () => '15/06/2025');
  const { db, customer } = settlementFixture();

  const first = ledger.recordSettlement(db, '7', 125.25, 'cash', 'June payment');

  assert.equal(first.ok, true);
  assert.deepEqual(first.settlement, {
    id: 501,
    customerId: 7,
    customerName: 'Corner Market',
    date: '15/06/2025',
    amount: 125.25,
    mode: 'cash',
    note: 'June payment'
  });
  assert.deepEqual(first.customer, {
    id: 7,
    name: 'Corner Market',
    openingBalance: 100,
    totalBilled: 600,
    totalSettled: 175.25,
    balance: 524.75
  });

  const second = ledger.recordSettlement(db, 7, 25);

  assert.equal(second.ok, true);
  assert.deepEqual(second.settlement, {
    id: 502,
    customerId: 7,
    customerName: 'Corner Market',
    date: '15/06/2025',
    amount: 25,
    mode: 'upi',
    note: 'Khata settlement'
  });
  assert.deepEqual(db.settlements, [second.settlement, first.settlement]);
  assert.equal(db.nextSettlementId, 503);
  assert.equal(customer.totalSettled, 200.25);
  assert.equal(customer.balance, 499.75);
});

test('Khata settlements reject missing customers and nonpositive amounts without updating the ledger', () => {
  const { db } = settlementFixture();
  const before = structuredClone(db);

  assert.deepEqual(ledger.recordSettlement(db, 99, 10), {
    ok: false,
    error: 'Customer not found'
  });
  for (const amount of [undefined, '', 0, '0', -10]) {
    assert.deepEqual(ledger.recordSettlement(db, 7, amount), {
      ok: false,
      error: 'Settlement amount must be greater than zero'
    });
  }
  assert.deepEqual(db, before);
});

test('browser amount strings add numerically and reduce the outstanding balance', () => {
  const { db, customer } = settlementFixture();

  const first = ledger.recordSettlement(db, '7', '125.25');

  assert.equal(first.ok, true);
  assert.equal(first.settlement.amount, 125.25);
  assert.equal(customer.totalSettled, 175.25);
  assert.equal(customer.balance, 524.75);

  const second = ledger.recordSettlement(db, '7', '25.50');

  assert.equal(second.ok, true);
  assert.deepEqual(db.settlements.map((entry) => entry.amount), [25.50, 125.25]);
  assert.equal(customer.totalSettled, 200.75);
  assert.equal(customer.balance, 499.25);
  const [listedCustomer] = ledger.listCustomers(db);
  assert.equal(listedCustomer.totalSettled, 200.75);
  assert.equal(listedCustomer.balance, 499.25);
});

test('invalid payment amounts leave the ledger and receipts untouched', () => {
  const { db } = settlementFixture();
  const before = structuredClone(db);

  for (const amount of ['invalid', 'Infinity', Infinity, true, [25]]) {
    assert.deepEqual(ledger.recordSettlement(db, 7, amount), {
      ok: false,
      error: 'Settlement amount must be greater than zero'
    });
  }
  assert.deepEqual(db, before);
});

test('a missing settled total starts at zero when a payment is recorded', () => {
  const { db, customer } = settlementFixture();
  delete customer.totalSettled;

  const result = ledger.recordSettlement(db, 7, 25);

  assert.equal(result.ok, true);
  assert.equal(result.settlement.amount, 25);
  assert.equal(customer.totalSettled, 25);
  assert.equal(customer.balance, 675);
  const [listedCustomer] = ledger.listCustomers(db);
  assert.equal(listedCustomer.totalSettled, 25);
  assert.equal(listedCustomer.balance, 675);
});

test('a numeric string already stored as the settled total is added as a number', () => {
  const { db, customer } = settlementFixture();
  customer.totalSettled = '50.25';

  const result = ledger.recordSettlement(db, 7, '25');

  assert.equal(result.ok, true);
  assert.equal(customer.totalSettled, 75.25);
  assert.equal(customer.balance, 624.75);
});

test('a nonnumeric stored total is preserved for reconciliation', () => {
  const { db, customer } = settlementFixture();
  customer.totalSettled = '50invalid';
  const before = structuredClone(db);

  assert.deepEqual(ledger.recordSettlement(db, 7, 25), {
    ok: false,
    error: 'Customer settled total is invalid'
  });
  assert.deepEqual(db, before);
});
