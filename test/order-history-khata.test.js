const test = require('node:test');
const assert = require('node:assert/strict');
const orders = require('../lib/orders');
const ledger = require('../lib/ledger');
const dates = require('../lib/dates');

test('order history sorts chronologically and includes the date range boundaries', () => {
  const db = { orders: [
    { id: 1, date: '28/12/2021' },
    { id: 2, date: '30/01/2022' },
    { id: 3, date: '15/03/2022' },
  ] };
  assert.deepEqual(orders.list(db).map((order) => order.id), [3, 2, 1]);
  assert.deepEqual(orders.list(db, { from: '2022-01-30', to: '15/03/2022' }).map((order) => order.id), [3, 2]);
});

test('settling from the form adds the payment numerically', () => {
  const customer = { id: 1, name: 'Customer', openingBalance: 2432.01, totalSettled: 1200 };
  const db = { customers: [customer], nextSettlementId: 1 };
  const result = ledger.recordSettlement(db, 1, '500', 'cash');
  assert.equal(result.ok, true);
  assert.equal(result.settlement.amount, 500);
  assert.equal(customer.totalSettled, 1700);
  assert.equal(customer.balance, 732.01);
});

test('both supported date formats preserve the April fiscal-year boundary', () => {
  assert.equal(dates.getFiscalYear('31/03/2022'), 'FY21-22');
  assert.equal(dates.getFiscalYear('2022-04-01'), 'FY22-23');
});

test('settlement rejects invalid or sub-paisa payments and records valid amounts to the paisa', () => {
  const customer = { id: 1, name: 'Customer', openingBalance: 100, totalSettled: '10.00' };
  const db = { customers: [customer], nextSettlementId: 1 };

  for (const amount of ['invalid', Infinity, '0.004']) {
    assert.equal(ledger.recordSettlement(db, 1, amount, 'cash').ok, false);
  }
  assert.equal(customer.totalSettled, '10.00');
  assert.equal(db.nextSettlementId, 1);

  const result = ledger.recordSettlement(db, 1, '1.235', 'cash');
  assert.equal(result.settlement.amount, 1.24);
  assert.equal(customer.totalSettled, 11.24);
  assert.equal(customer.balance, 88.76);
});
