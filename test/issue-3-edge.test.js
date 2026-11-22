'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const dates = require('../lib/dates');
const orders = require('../lib/orders');
const ledger = require('../lib/ledger');

function fixture() {
  return { nextSettlementId: 1, settlements: [], auditLog: [], customers: [{
    id: 1, openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200, balance: 1232.01
  }] };
}

test('calendar keys validate leap years, preserve equal-date order and retain response dates', () => {
  assert.equal(dates.chronologicalKey('29/02/2000'), '20000229');
  for (const date of ['29/02/1900', '2023-02-29', '31/04/2022', 'bad']) {
    assert.equal(dates.chronologicalKey(date), '');
  }
  const db = { orders: [{ id: 1, date: '15/03/2022' }, { id: 2, date: '2022-03-15' }] };
  const before = structuredClone(db);
  assert.deepEqual(orders.list(db), before.orders);
  assert.deepEqual(db, before);
  assert.deepEqual(orders.list(db, { from: '2023-02-29' }), []);
  assert.equal(dates.getFiscalYear('01/04/2022'), 'FY22-23');
  assert.equal(dates.getFiscalYear('2022-03-31'), 'FY21-22');
});

test('malformed historical monetary fields cannot corrupt a settlement', () => {
  for (const key of ['openingBalance', 'totalBilled', 'totalSettled']) {
    for (const value of [null, '', ' ', true, {}, [], 'bad', Infinity]) {
      const db = fixture();
      db.customers[0][key] = value;
      const before = structuredClone(db);
      assert.equal(ledger.recordSettlement(db, 1, '500').ok, false, key + ': ' + String(value));
      assert.deepEqual(db, before);
    }
  }
});

test('currency range and rounded-zero payments fail before mutation; decimal legacy fields add numerically', () => {
  for (const amount of [0.001, Number.MAX_SAFE_INTEGER, '1e309']) {
    const db = fixture();
    const before = structuredClone(db);
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false);
    assert.deepEqual(db, before);
  }
  const db = fixture();
  Object.assign(db.customers[0], { openingBalance: '450', totalBilled: '1982.01', totalSettled: '1200' });
  const result = ledger.recordSettlement(db, 1, '500.25');
  assert.equal(result.customer.totalSettled, 1700.25);
  assert.equal(result.customer.balance, 731.76);
  assert.equal(result.settlement.amount, 500.25);
});

test('settlement endpoint rejects invalid payments without writes and preserves successful audit/persistence', t => {
  const store = require('../lib/store');
  const router = require('../routes/customers');
  const handler = router.stack.find(layer => layer.route && layer.route.path === '/customers/:id/settle').route.stack[0].handle;
  let db;
  t.mock.method(store, 'read', () => db);
  const write = t.mock.method(store, 'write', () => {});
  const audit = t.mock.method(store, 'appendAudit', () => {});
  for (const amount of [undefined, null, '', ' ', 'bad', 0, -1, NaN, Infinity, true, false, {}, [], [500]]) {
    db = fixture();
    const before = structuredClone(db);
    let status;
    handler({ params: { id: '1' }, body: { amount } }, {
      status(code) { status = code; return this; }, json(body) { assert.equal(typeof body.error, 'string'); }
    });
    assert.equal(status, 400);
    assert.deepEqual(db, before);
  }
  assert.equal(write.mock.callCount(), 0);
  assert.equal(audit.mock.callCount(), 0);
  db = fixture();
  let status;
  handler({ params: { id: '1' }, body: { amount: '500', mode: 'upi', note: 'Fixture' } }, {
    status(code) { status = code; return this; }, json(result) {
      assert.equal(result.customer.totalSettled, 1700);
      assert.equal(result.customer.balance, 732.01);
      assert.equal(result.settlement.amount, 500);
    }
  });
  assert.equal(status, 201);
  assert.equal(write.mock.callCount(), 1);
  assert.equal(audit.mock.callCount(), 1);
  assert.equal(audit.mock.calls[0].arguments[1], 'KHATA_SETTLEMENT');
});
