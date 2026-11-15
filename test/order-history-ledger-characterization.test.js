const test = require('node:test');
const assert = require('node:assert/strict');
const orders = require('../lib/orders');
const ledger = require('../lib/ledger');

test('order history sorts by actual calendar date newest first', () => {
  const db = { orders: [
    { id: 1004, date: '30/01/2022' },
    { id: 1001, date: '28/12/2021' },
    { id: 1008, date: '15/03/2022' },
    { id: 1007, date: '04/03/2022' }
  ] };
  assert.deepEqual(orders.list(db, {}).map(o => o.id), [1008, 1007, 1004, 1001]);
});

test('date range filters include the selected calendar days', () => {
  const db = { orders: [
    { id: 1, date: '28/12/2021' },
    { id: 2, date: '05/01/2022' },
    { id: 3, date: '30/01/2022' },
    { id: 4, date: '04/03/2022' }
  ] };
  assert.deepEqual(orders.list(db, { from: '2022-01-01', to: '2022-01-31' }).map(o => o.id), [3, 2]);
});

test('settlement amount from an HTML input adds numerically to customer balance', () => {
  const db = {
    customers: [{ id: 1, name: 'Meera Joshi', openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200 }],
    nextSettlementId: 1
  };
  const result = ledger.recordSettlement(db, 1, '500', 'cash');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});
