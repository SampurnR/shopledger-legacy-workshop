'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const orders = require('../lib/orders');
const ledger = require('../lib/ledger');

function history() {
  return { orders: [
    { id: 1008, date: '15/03/2022' }, { id: 1007, date: '04/03/2022' },
    { id: 1004, date: '30/01/2022' }, { id: 1001, date: '28/12/2021' }
  ] };
}
function ids(db, filters) { return orders.list(db, filters).map(o => o.id); }
function khata(totalSettled = 1200) {
  return { nextSettlementId: 505, settlements: [], auditLog: [], customers: [{
    id: 1, name: 'Meera Joshi', openingBalance: 450, totalBilled: 1982.01,
    totalSettled, balance: 1232.01
  }] };
}

test('history sorts newest first across days, months and years without mutation', () => {
  const db = history();
  const before = structuredClone(db);
  assert.deepEqual(ids(db), [1008, 1007, 1004, 1001]);
  assert.deepEqual(db, before);
});
test('ISO January range includes only January orders', () => {
  assert.deepEqual(ids(history(), { from: '2022-01-01', to: '2022-01-31' }), [1004]);
});
test('January start/end boundaries are inclusive and adjacent months excluded', () => {
  const db = { orders: [
    { id: 1, date: '01/01/2022' }, { id: 31, date: '31/01/2022' },
    { id: 1231, date: '31/12/2021' }, { id: 201, date: '01/02/2022' }
  ] };
  assert.deepEqual(ids(db, { from: '2022-01-01', to: '2022-01-31' }), [31, 1]);
});
test('same-day ranges include exactly that calendar date', () => {
  const db = { orders: [{ id: 1, date: '01/01/2022' }, { id: 2, date: '02/01/2022' }] };
  assert.deepEqual(ids(db, { from: '2022-01-01', to: '2022-01-01' }), [1]);
});
test('cross-year range compares calendar dates rather than day numbers', () => {
  assert.deepEqual(ids(history(), { from: '2021-12-28', to: '2022-01-30' }), [1004, 1001]);
});
test('leap-day range includes February 29 and March 1 in chronological order', () => {
  const db = { orders: [
    { id: 228, date: '28/02/2024' }, { id: 229, date: '29/02/2024' },
    { id: 301, date: '01/03/2024' }, { id: 302, date: '02/03/2024' }
  ] };
  assert.deepEqual(ids(db, { from: '2024-02-29', to: '2024-03-01' }), [301, 229]);
});
test('supported ISO and day-first order dates sort and filter compatibly without timezone parsing', () => {
  const db = { orders: [
    { id: 1, date: '2022-03-15' }, { id: 2, date: '04/03/2022' }, { id: 3, date: '30/01/2022' }
  ] };
  assert.deepEqual(ids(db, { from: '2022-01-01', to: '2022-03-31' }), [1, 2, 3]);
});
test('a date range with no matching calendar dates returns no orders', () => {
  assert.deepEqual(ids(history(), { from: '2022-04-01', to: '2022-04-30' }), []);
});
test('blank date bounds mean no filtering under the existing API contract', () => {
  assert.deepEqual(ids(history(), { from: '', to: '' }).sort(), [1001, 1004, 1007, 1008]);
  assert.deepEqual(ids({ orders: [] }, {}), []);
});
test('reversed same-month bounds yield no orders as in the existing API', () => {
  assert.deepEqual(ids(history(), { from: '2022-01-31', to: '2022-01-01' }), []);
});
test('reversed cross-year bounds likewise yield no orders', () => {
  assert.deepEqual(ids(history(), { from: '2022-01-01', to: '2021-12-31' }), []);
});

for (const [name, existing, payment] of [
  ['number plus string', 1200, '500'], ['string plus number', '1200', 500],
  ['string plus string', '1200', '500'], ['number plus number', 1200, 500]
]) {
  test('Meera settlement uses numeric arithmetic: ' + name, () => {
    const db = khata(existing);
    const result = ledger.recordSettlement(db, 1, payment, 'upi', 'Regression fixture');
    assert.equal(result.ok, true);
    assert.deepEqual({ total: result.customer.totalSettled, balance: result.customer.balance },
      { total: 1700, balance: 732.01 });
    assert.equal(ledger.listCustomers(db)[0].balance, 732.01);
    assert.equal(result.settlement.amount, 500);
    assert.equal(Number.isFinite(result.settlement.amount), true);
    assert.deepEqual(db.settlements, [result.settlement]);
    assert.equal(db.nextSettlementId, 506);
    assert.deepEqual(db.auditLog, []);
  });
}
test('decimal string payment retains paise in total, entry and balance', () => {
  const result = ledger.recordSettlement(khata(), 1, '0.25');
  // 1200 + .25 = 1200.25; 450 + 1982.01 - 1200.25 = 1231.76.
  assert.deepEqual({ total: result.customer.totalSettled, balance: result.customer.balance, amount: result.settlement.amount },
    { total: 1200.25, balance: 1231.76, amount: 0.25 });
});
test('numeric decimal addition rounds monetary totals to two decimal places', () => {
  const result = ledger.recordSettlement(khata(0.1), 1, 0.2);
  // .10 + .20 = .30; 2432.01 - .30 = 2431.71.
  assert.deepEqual({ total: result.customer.totalSettled, balance: result.customer.balance, amount: result.settlement.amount },
    { total: 0.3, balance: 2431.71, amount: 0.2 });
});

const invalidPayments = [
  ['missing', undefined], ['null', null], ['empty', ''], ['whitespace', ' \t '],
  ['malformed', 'bad'], ['zero', 0], ['negative', -1], ['NaN', NaN],
  ['Infinity', Infinity], ['true', true], ['false', false], ['object', {}],
  ['empty array', []], ['numeric array', [500]]
];
for (const [name, payment] of invalidPayments) {
  test('invalid payment leaves all ledger state unchanged: ' + name, () => {
    const db = khata();
    const before = structuredClone(db);
    const result = ledger.recordSettlement(db, 1, payment);
    assert.equal(result.ok, false);
    assert.equal(typeof result.error, 'string');
    assert.deepEqual(db, before, 'totals, balances, entries, IDs and audit state must not change');
  });
}

test('settlement route rejects malformed payment with HTTP 400 and no persistence', t => {
  const store = require('../lib/store');
  const router = require('../routes/customers');
  const handler = router.stack.find(layer => layer.route && layer.route.path === '/customers/:id/settle').route.stack[0].handle;
  const db = khata();
  const before = structuredClone(db);
  t.mock.method(store, 'read', () => db);
  // Count calls so RED output reports the business failure, not a mock exception.
  const write = t.mock.method(store, 'write', () => {});
  const audit = t.mock.method(store, 'appendAudit', () => {});
  let status;
  handler({ params: { id: '1' }, body: { amount: 'bad' } }, {
    status(code) { status = code; return this; }, json() {}
  });
  assert.equal(status, 400);
  assert.equal(write.mock.callCount(), 0);
  assert.equal(audit.mock.callCount(), 0);
  assert.deepEqual(db, before);
});
