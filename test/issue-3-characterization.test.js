'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const dates = require('../lib/dates');
const orders = require('../lib/orders');
const ledger = require('../lib/ledger');

function history() {
  return { orders: [
    { id: 1008, date: '15/03/2022' },
    { id: 1007, date: '04/03/2022' },
    { id: 1004, date: '30/01/2022' },
    { id: 1001, date: '28/12/2021' }
  ] };
}
function khata(totalSettled = 1200) {
  return { nextSettlementId: 505, settlements: [], customers: [{
    id: 1, name: 'Meera Joshi', openingBalance: 450,
    totalBilled: 1982.01, totalSettled, balance: 1232.01
  }] };
}

test('display date normalization preserves the existing day-first interface', () => {
  assert.equal(dates.normalizeDateKey('2022-01-01'), '01/01/2022');
  assert.equal(dates.normalizeDateKey(' 30/01/2022 '), '30/01/2022');
  assert.equal(dates.normalizeDateKey('2021-12-28'), '28/12/2021');
});

test('history sorts chronologically across months and years', () => {
  const db = history();
  const before = structuredClone(db);
  assert.deepEqual(orders.list(db).map(o => o.id), [1008, 1007, 1004, 1001]);
  assert.deepEqual(db, before, 'listing does not mutate stored order sequence');
});

test('January range excludes December and March orders', () => {
  assert.deepEqual(orders.list(history(), { from: '2022-01-01', to: '2022-01-31' }).map(o => o.id),
    [1004]);
});

test('date filters include equal start and end boundaries', () => {
  const db = { orders: [{ id: 1, date: '01/01/2022' }, { id: 31, date: '31/01/2022' }] };
  assert.deepEqual(orders.list(db, { from: '2022-01-01', to: '2022-01-31' }).map(o => o.id), [31, 1]);
  assert.deepEqual(orders.list(db, { from: '2022-01-01', to: '2022-01-01' }).map(o => o.id), [1]);
  assert.deepEqual(orders.list(db, { from: '2022-01-31', to: '2022-01-31' }).map(o => o.id), [31]);
});

test('fiscal-year calculation accepts existing date formats', () => {
  assert.equal(dates.getFiscalYear('31/03/2022'), 'FY21-22');
  assert.equal(dates.getFiscalYear('2022-04-01'), 'FY22-23');
});

test('UI string settlement adds numerically to existing total', () => {
  const db = khata();
  const result = ledger.recordSettlement(db, 1, '500', 'upi', 'Fixture payment');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  // 450 + 1982.01 - 1700 = 732.01.
  assert.equal(result.customer.balance, 732.01);
  assert.equal(ledger.listCustomers(db)[0].balance, 732.01);
  assert.equal(result.settlement.amount, 500);
  assert.deepEqual(db.settlements, [result.settlement]);
  assert.equal(result.settlement.id, 505);
  assert.equal(result.settlement.customerId, 1);
  assert.equal(result.settlement.mode, 'upi');
  assert.equal(result.settlement.note, 'Fixture payment');
  assert.match(result.settlement.date, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.equal(db.nextSettlementId, 506);
});

test('numeric-string existing total adds to numeric new amount', () => {
  const db = khata('1200');
  const result = ledger.recordSettlement(db, 1, 500);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});

test('numeric-string existing total and string payment add numerically', () => {
  const result = ledger.recordSettlement(khata('1200'), 1, '500');
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
});

test('fully numeric settlement adds correctly and updates outstanding balance', () => {
  const db = khata();
  assert.equal(ledger.listCustomers(db)[0].balance, 1232.01);
  const result = ledger.recordSettlement(db, 1, 500);
  assert.equal(result.customer.totalSettled, 1700);
  // 450 + 1982.01 - 1700 = 732.01.
  assert.equal(result.customer.balance, 732.01);
  assert.equal(ledger.listCustomers(db)[0].balance, 732.01);
});

test('zero or negative settlements and missing customers fail without mutation', () => {
  for (const amount of [0, -1, '0', '-1']) {
    const db = khata();
    const before = structuredClone(db);
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false);
    assert.deepEqual(db, before);
  }
  const db = khata();
  const before = structuredClone(db);
  assert.deepEqual(ledger.recordSettlement(db, 99, 500), { ok: false, error: 'Customer not found' });
  assert.deepEqual(db, before);
});
