const test = require('node:test');
const assert = require('node:assert/strict');

const dates = require('../lib/dates');
const ledger = require('../lib/ledger');
const orders = require('../lib/orders');

function orderDates() {
  return [
    { id: 1001, date: '28/12/2021', status: 'completed' },
    { id: 1002, date: '05/01/2022', status: 'completed' },
    { id: 1003, date: '14/01/2022', status: 'completed' },
    { id: 1004, date: '30/01/2022', status: 'completed' },
    { id: 1005, date: '02/02/2022', status: 'completed' },
    { id: 1006, date: '18/02/2022', status: 'completed' },
    { id: 1007, date: '04/03/2022', status: 'pending' },
    { id: 1008, date: '15/03/2022', status: 'completed' }
  ];
}

function khataDb() {
  return {
    nextSettlementId: 505,
    settlements: [],
    customers: [
      {
        id: 1,
        name: 'Test customer',
        openingBalance: 450,
        totalBilled: 1982.01,
        totalSettled: 1200,
        balance: 1232.01
      }
    ]
  };
}

test('CURRENT BEHAVIOUR: order history sorts DD/MM/YYYY values lexically', () => {
  const result = orders.list({ orders: orderDates() }, {});

  assert.deepEqual(result.map((order) => order.id), [1004, 1001, 1006, 1008, 1003, 1002, 1007, 1005]);
});

test('CURRENT BEHAVIOUR: February to March date filter returns orders outside the range', () => {
  const result = orders.list(
    { orders: orderDates() },
    { from: '2022-02-01', to: '2022-03-31' }
  );

  assert.deepEqual(result.map((order) => order.id), [1004, 1001, 1006, 1008, 1003, 1002, 1007, 1005]);
});

test('CURRENT BEHAVIOUR: ISO filter date normalizes back to display order', () => {
  assert.equal(dates.normalizeDateKey('2022-03-15'), '15/03/2022');
});

test('CURRENT BEHAVIOUR: string settlement concatenates onto total settled', () => {
  const db = khataDb();

  const result = ledger.recordSettlement(db, 1, '500', 'upi', 'Characterization test');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, '1200500');
  assert.equal(result.customer.balance, -1198067.99);
  assert.equal(result.settlement.amount, 500);
});

test('CURRENT BEHAVIOUR: non-numeric settlement is accepted and corrupts the balance', () => {
  const db = khataDb();

  const result = ledger.recordSettlement(db, 1, 'abc', 'cash', 'Characterization test');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, '1200abc');
  assert.equal(Number.isNaN(result.customer.balance), true);
});

test('numeric settlement already updates the balance arithmetically', () => {
  const db = khataDb();

  const result = ledger.recordSettlement(db, 1, 500, 'cash', 'Control');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(db.settlements[0].amount, 500);
});

test('fiscal year calculation handles ISO dates around the April boundary', () => {
  assert.equal(dates.getFiscalYear('2022-03-15'), 'FY21-22');
  assert.equal(dates.getFiscalYear('2022-04-01'), 'FY22-23');
});
