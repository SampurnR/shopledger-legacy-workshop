const assert = require('node:assert/strict');
const { test } = require('node:test');
const ledger = require('../lib/ledger');
const orders = require('../lib/orders');

function historyFixture() {
  const dates = [
    '28/12/2021', '05/01/2022', '14/01/2022', '30/01/2022',
    '02/02/2022', '18/02/2022', '04/03/2022', '15/03/2022'
  ];
  return {
    orders: dates.map((date, index) => ({
      id: 1001 + index, date, status: index === 6 ? 'pending' : 'completed'
    }))
  };
}

test('order history puts March #1008 ahead of January #1004 and December #1001', () => {
  const db = historyFixture();

  assert.deepEqual(orders.list(db).map(order => order.id), [
    1008, 1007, 1006, 1005, 1004, 1003, 1002, 1001
  ]);
  assert.equal(db.orders[0].date, '28/12/2021');
  assert.equal(db.orders[7].date, '15/03/2022');
});

test('an ISO date range keeps both endpoints and excludes orders in earlier months', () => {
  const db = historyFixture();
  const range = { from: '2022-02-02', to: '2022-03-15' };

  assert.deepEqual(orders.list(db, range).map(order => order.id), [1008, 1007, 1006, 1005]);
  assert.deepEqual(orders.list(db, { ...range, status: 'pending', search: '1007' })
    .map(order => order.id), [1007]);
});

test('date filters accept one or both boundaries across calendar years', () => {
  const db = historyFixture();

  assert.deepEqual(orders.list(db, { from: '28/12/2021', to: '2022-01-05' })
    .map(order => order.id), [1002, 1001]);
  assert.deepEqual(orders.list(db, { to: '05/01/2022' }).map(order => order.id), [1002, 1001]);
  assert.deepEqual(orders.list(db, { from: '2022-03-04' }).map(order => order.id), [1008, 1007]);
});

test('dates stored in either format compare by calendar day and then by newest order ID', () => {
  const db = {
    orders: [
      { id: 1001, date: '2022-02-02' },
      { id: 1002, date: '02/02/2022' },
      { id: 1003, date: '2/2/2022' },
      { id: 1004, date: '15/01/2022' }
    ]
  };

  assert.deepEqual(orders.list(db).map(order => order.id), [1003, 1002, 1001, 1004]);
  assert.deepEqual(orders.list(db, { from: '2022-02-02', to: '02/02/2022' })
    .map(order => order.id), [1003, 1002, 1001]);
});

test('impossible dates do not match a range and leap day still does', () => {
  const db = { orders: [
    { id: 1, date: '28/02/2022' },
    { id: 2, date: '31/02/2022' },
    { id: 3, date: '29/02/2024' }
  ] };

  assert.deepEqual(orders.list(db, { to: '2022-02-31' }), []);
  assert.deepEqual(orders.list(db, { from: '2022-02-01', to: '2022-03-01' })
    .map(order => order.id), [1]);
  assert.deepEqual(orders.list(db, { from: '2024-02-29', to: '29/02/2024' })
    .map(order => order.id), [3]);
});

function customerLedger(totalSettled = 1200) {
  return {
    customers: [{ id: 1, name: 'Fixture account', openingBalance: 450, totalBilled: 1982.01, totalSettled }],
    settlements: [],
    nextSettlementId: 501
  };
}

test('a ₹500 browser settlement increases ₹1,200 settled and reduces the balance by ₹500', () => {
  const db = customerLedger();
  assert.equal(ledger.listCustomers(db)[0].balance, 1232.01);

  const result = ledger.recordSettlement(db, '1', '500', 'upi', 'Part payment');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(ledger.listCustomers(db)[0].balance, 732.01);
  assert.equal(result.settlement.amount, 500);
  assert.equal(result.settlement.id, 501);
  assert.equal(result.settlement.note, 'Part payment');
  assert.deepEqual(db.settlements, [result.settlement]);
  assert.equal(db.nextSettlementId, 502);
});

test('a numeric payment adds to a historical numeric-string total with paisa precision', () => {
  const db = customerLedger('1200.10');

  const result = ledger.recordSettlement(db, 1, 20.2);

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1220.3);
  assert.equal(result.customer.balance, 1211.71);
  assert.equal(result.settlement.amount, 20.2);
  assert.equal(result.settlement.mode, 'upi');
});

test('a payment uses zero when an older account has no stored settled total', () => {
  const db = customerLedger();
  delete db.customers[0].totalSettled;

  const result = ledger.recordSettlement(db, 1, '5e2');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 500);
  assert.equal(result.customer.balance, 1932.01);
});

test('invalid settlement amounts leave the customer, receipts, and receipt counter intact', () => {
  const db = customerLedger();
  const before = structuredClone(db);

  for (const amount of ['not a number', 'Infinity', Infinity, NaN, 0, -1, '  ', null, true, [500]]) {
    const result = ledger.recordSettlement(db, 1, amount);
    assert.deepEqual(result, { ok: false, error: 'Settlement amount must be greater than zero' }, String(amount));
    assert.deepEqual(db, before);
  }
});

test('malformed stored ledger amounts block settlement without writing a receipt', () => {
  const invalid = [
    ['totalSettled', 'invalid prior total'], ['totalSettled', false], ['totalSettled', ''],
    ['totalSettled', null], ['openingBalance', false], ['totalBilled', '']
  ];
  for (const [field, value] of invalid) {
    const db = customerLedger();
    db.customers[0][field] = value;
    const before = structuredClone(db);

    assert.equal(ledger.recordSettlement(db, 1, 500).ok, false);
    assert.deepEqual(db, before);
  }
});

test('the net balance remains exact when the intermediate gross amount is large', () => {
  const db = customerLedger(50000000000000);
  db.customers[0].openingBalance = 50000000000000;
  db.customers[0].totalBilled = 50000000000000;

  assert.equal(ledger.listCustomers(db)[0].balance, 50000000000000);
  const result = ledger.recordSettlement(db, 1, 1);
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 50000000000001);
  assert.equal(result.customer.balance, 49999999999999);
  assert.equal(ledger.listCustomers(db)[0].balance, 49999999999999);
});

test('recording and reloading a balance handles numeric-string account components', () => {
  const db = customerLedger('1200');
  db.customers[0].openingBalance = '450.00';
  db.customers[0].totalBilled = '1982.01';

  assert.equal(ledger.listCustomers(db)[0].balance, 1232.01);
  const result = ledger.recordSettlement(db, 1, '500');
  assert.equal(result.ok, true);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(ledger.listCustomers(db)[0].balance, 732.01);
});

test('fractional-paisa payments are rejected before writing a receipt', () => {
  const db = customerLedger();
  const before = structuredClone(db);

  for (const amount of [0.001, '12.345', '1.0000000000000001']) {
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false);
    assert.deepEqual(db, before);
  }
});

test('an unrepresentable payment or resulting settled total leaves the ledger intact', () => {
  for (const [prior, amount] of [[1200, 1e16], [1200, '70368744177664.01'], [90071992547409, 1]]) {
    const db = customerLedger(prior);
    const before = structuredClone(db);

    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false);
    assert.deepEqual(db, before);
  }
});
