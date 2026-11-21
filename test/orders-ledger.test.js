const test = require('node:test');
const assert = require('node:assert/strict');
const orders = require('../lib/orders');
const dates = require('../lib/dates');
const ledger = require('../lib/ledger');

function listedDates(filters) {
  const db = { orders: [
    { date: '15/03/2022' },
    { date: '30/01/2022' },
    { date: '28/12/2021' }
  ] };
  return orders.list(db, filters).map(order => order.date);
}

test('history sorts newest first across months and years', () => {
  assert.deepEqual(listedDates(), ['15/03/2022', '30/01/2022', '28/12/2021']);
  const sameDay = { orders: [{ id: 1, date: '15/03/2022' }, { id: 2, date: '15/03/2022' }] };
  assert.deepEqual(orders.list(sameDay).map(order => order.id), [2, 1]);
});

test('from includes the lower bound and later orders', () => {
  assert.deepEqual(listedDates({ from: '2022-01-30' }), ['15/03/2022', '30/01/2022']);
});

test('to includes the upper bound and earlier orders', () => {
  assert.deepEqual(listedDates({ to: '2022-01-30' }), ['30/01/2022', '28/12/2021']);
});

test('January to March range includes both endpoints', () => {
  assert.deepEqual(listedDates({ from: '2022-01-30', to: '2022-03-15' }), ['15/03/2022', '30/01/2022']);
});

test('CURRENT BEHAVIOUR: normalizeDateKey returns day-first text', () => {
  assert.equal(dates.normalizeDateKey('2022-03-15'), '15/03/2022');
  assert.equal(dates.normalizeDateKey(' 15/03/2022 '), '15/03/2022');
  assert.equal(dates.normalizeDateKey(''), '');
});

function ledgerFixture() {
  return {
    customers: [{
      id: 1, name: 'Test customer', openingBalance: 0, totalBilled: 2432.01,
      totalSettled: 1200, balance: 1232.01
    }],
    settlements: [],
    nextSettlementId: 1
  };
}

function assertAccepted(amount, expectedTotal, expectedBalance, expectedEntryAmount) {
  const db = ledgerFixture();
  const result = ledger.recordSettlement(db, 1, amount);
  assert.equal(result.ok, true);
  assert.equal(db.customers[0].totalSettled, expectedTotal);
  assert.equal(db.customers[0].balance, expectedBalance);
  assert.deepEqual(db.settlements, [result.settlement]);
  assert.equal(result.settlement.amount, expectedEntryAmount);
  assert.equal(result.settlement.customerId, 1);
  assert.equal(result.settlement.id, 1);
  assert.equal(db.nextSettlementId, 2);
}

test('CURRENT BEHAVIOUR: numeric payment reduces balance', () => {
  assertAccepted(500, 1700, 732.01, 500);
});

test('string payment reduces balance numerically', () => {
  assertAccepted('500', 1700, 732.01, 500);
});

test('CURRENT BEHAVIOUR: zero and negative payments leave ledger intact', () => {
  for (const amount of [0, -500]) {
    const db = ledgerFixture();
    const result = ledger.recordSettlement(db, 1, amount);
    assert.deepEqual(result, { ok: false, error: 'Settlement amount must be greater than zero' });
    assert.deepEqual(db, ledgerFixture());
  }
});

test('invalid payments leave the ledger intact', () => {
  for (const amount of ['abc', ' ', null, true, [500], {}, Infinity, NaN]) {
    const db = ledgerFixture();
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false);
    assert.deepEqual(db, ledgerFixture());
  }
});

test('successive string and numeric payments reduce the same balance', () => {
  const db = ledgerFixture();
  for (const amount of ['500', 100]) {
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, true);
  }
  assert.equal(db.customers[0].totalSettled, 1800);
  assert.equal(db.customers[0].balance, 632.01);
  assert.deepEqual(db.settlements.map(entry => entry.amount), [100, 500]);
  for (const amount of ['10.004', 10.004]) {
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, true);
  }
  assert.equal(db.customers[0].balance, 612);
});
