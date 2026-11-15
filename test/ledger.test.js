const test = require('node:test');
const assert = require('node:assert/strict');
const ledger = require('../lib/ledger');
const dates = require('../lib/dates');

function fixture() {
  return {
    customers: [{
      id: 1, name: 'Meera Joshi', openingBalance: 450,
      totalBilled: 1982.01, totalSettled: 1200, balance: 1232.01
    }],
    nextSettlementId: 501,
    settlements: []
  };
}

test('CURRENT BEHAVIOUR: customer listing computes the initial balance from ledger totals', () => {
  const db = fixture();
  db.customers[0].balance = 999;
  const before = structuredClone(db);
  const customer = ledger.listCustomers(db)[0];
  assert.equal(customer.balance, 1232.01);
  assert.equal(customer.totalSettled, 1200);
  assert.deepEqual(db, before);
});

test('string settlement amount adds arithmetically and preserves Meera balance', t => {
  t.mock.method(dates, 'today', () => '15/03/2022');
  const db = fixture();
  const previousEntry = { id: 500, amount: 1200 };
  db.settlements.push(previousEntry);
  // The browser sends the input value as a string; the customer route passes it through.
  const result = ledger.recordSettlement(db, '1', '500', 'cash', 'Part payment');
  assert.equal(result.ok, true);
  assert.strictEqual(result.customer, db.customers[0]);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.customer.openingBalance, 450);
  assert.equal(result.customer.totalBilled, 1982.01);
  assert.deepEqual(result.settlement, {
    id: 501, customerId: 1, customerName: 'Meera Joshi', date: '15/03/2022',
    amount: 500, mode: 'cash', note: 'Part payment'
  });
  assert.strictEqual(db.settlements[0], result.settlement);
  assert.strictEqual(db.settlements[1], previousEntry);
  assert.equal(db.nextSettlementId, 502);
  const listed = ledger.listCustomers(db)[0];
  assert.equal(listed.totalSettled, 1700);
  assert.equal(listed.balance, 732.01);
});

test('CURRENT BEHAVIOUR: numeric 500 adds arithmetically and supplies settlement defaults', t => {
  t.mock.method(dates, 'today', () => '15/03/2022');
  const db = fixture();
  delete db.settlements;
  const result = ledger.recordSettlement(db, 1, 500);
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.deepEqual(result.settlement, {
    id: 501, customerId: 1, customerName: 'Meera Joshi', date: '15/03/2022',
    amount: 500, mode: 'upi', note: 'Khata settlement'
  });
  assert.deepEqual(db.settlements, [result.settlement]);
});

test('multiple string payments accumulate numerically', () => {
  const db = fixture();
  ledger.recordSettlement(db, 1, '500');
  ledger.recordSettlement(db, 1, '100');
  assert.equal(db.customers[0].totalSettled, 1800);
  assert.equal(db.customers[0].balance, 632.01);
  assert.deepEqual(db.settlements.map(entry => [entry.id, entry.amount]), [[502, 100], [501, 500]]);
});

test('CURRENT BEHAVIOUR: zero, negative and missing settlement amounts fail without mutation', () => {
  for (const amount of [0, '0', -500, '-500', '', null, undefined]) {
    const db = fixture();
    const before = structuredClone(db);
    assert.deepEqual(ledger.recordSettlement(db, 1, amount), {
      ok: false, error: 'Settlement amount must be greater than zero'
    });
    assert.deepEqual(db, before);
  }
});

test('CURRENT BEHAVIOUR: unknown customers fail without recording a settlement', () => {
  const db = fixture();
  const before = structuredClone(db);
  assert.deepEqual(ledger.recordSettlement(db, 999, '500'), {
    ok: false, error: 'Customer not found'
  });
  assert.deepEqual(db, before);
});
