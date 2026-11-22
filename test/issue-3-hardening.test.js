'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ledger = require('../lib/ledger');
const dates = require('../lib/dates');
const orders = require('../lib/orders');

function fixture() {
  return { nextSettlementId: 1, settlements: [], auditLog: [], customers: [{
    id: 1, name: 'Meera', openingBalance: '450', totalBilled: '1982.01', totalSettled: '1200'
  }] };
}

test('settlement then customer listing agrees for historical numeric-string fields', () => {
  const db = fixture();
  const result = ledger.recordSettlement(db, 1, '500');
  assert.equal(result.ok, true);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.customer.totalSettled, 1700);
  const before = structuredClone(db);
  assert.equal(ledger.listCustomers(db)[0].balance, 732.01);
  assert.deepEqual(db, before, 'reporting must never repair or mutate records');
});

test('customer reporting fails explicitly on malformed or unsafe historical totals', () => {
  for (const key of ['openingBalance', 'totalBilled', 'totalSettled']) {
    for (const value of [null, '', ' ', true, [], {}, 'bad', NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
      const db = fixture();
      db.customers[0][key] = value;
      const before = structuredClone(db);
      assert.throws(() => ledger.listCustomers(db), /ledger totals|currency range/i);
      assert.deepEqual(db, before);
    }
  }
});

test('settlement endpoint audits the rounded entry amount exactly once', t => {
  const store = require('../lib/store');
  const router = require('../routes/customers');
  const handler = router.stack.find(layer => layer.route && layer.route.path === '/customers/:id/settle').route.stack[0].handle;
  const db = fixture();
  t.mock.method(store, 'read', () => db);
  const write = t.mock.method(store, 'write', () => {});
  const audit = t.mock.method(store, 'appendAudit', () => {});
  let status;
  let entry;
  handler({ params: { id: '1' }, body: { amount: '0.005', mode: 'upi' } }, {
    status(code) { status = code; return this; }, json(result) { entry = result.settlement; }
  });
  assert.equal(status, 201);
  assert.equal(entry.amount, 0.01);
  assert.equal(audit.mock.callCount(), 1);
  assert.equal(write.mock.callCount(), 1);
  assert.equal(audit.mock.calls[0].arguments[1], 'KHATA_SETTLEMENT');
  assert.match(audit.mock.calls[0].arguments[2], /settled ₹0\.01 via UPI/);
  assert.doesNotMatch(audit.mock.calls[0].arguments[2], /0\.005/);
});

test('chronological date keys reject unsupported original types', () => {
  for (const date of [['2022-01-01'], ['01/01/2022'], {}, true, false, 20220101, null, undefined]) {
    assert.equal(dates.chronologicalKey(date), '');
  }
});

test('unsupported stored date types cannot match a valid date range', () => {
  const db = { orders: [{ id: 1, date: ['2022-01-01'] }, { id: 2, date: '01/01/2022' }] };
  const before = structuredClone(db);
  assert.deepEqual(orders.list(db, { from: '2022-01-01', to: '2022-01-01' }).map(o => o.id), [2]);
  assert.deepEqual(db, before);
});

test('legacy display normalization and supported calendar strings remain compatible', () => {
  assert.equal(dates.normalizeDateKey(['2022-01-01']), '01/01/2022');
  assert.equal(dates.chronologicalKey('2022-01-01'), '20220101');
  assert.equal(dates.chronologicalKey('01/01/2022'), '20220101');
  assert.equal(dates.getFiscalYear('2022-04-01'), 'FY22-23');
});
