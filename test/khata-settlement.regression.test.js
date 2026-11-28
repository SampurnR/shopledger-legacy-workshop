const assert = require('node:assert/strict');
const test = require('node:test');
const { isDeepStrictEqual } = require('node:util');
const ledger = require('../lib/ledger');
const store = require('../lib/store');
const router = require('../routes/customers');

const settlementRoute = router.stack.find(layer =>
  layer.route?.path === '/customers/:id/settle' && layer.route.methods.post
);
const settleCustomer = settlementRoute.route.stack[0].handle;

function issueFixture(customerOverrides) {
  return {
    customers: [{
      id: 77,
      name: 'Synthetic Khata Customer',
      openingBalance: 450,
      totalBilled: 1982.01,
      totalSettled: 1200,
      balance: 1232.01,
      ...customerOverrides
    }],
    settlements: [{ id: 500, customerId: 77, amount: 1200 }],
    auditLog: [{ action: 'ORDER_CREATED' }],
    nextSettlementId: 501
  };
}

function submit(t, db, body) {
  // Capture persisted values at the moment of write, independently of in-memory mutations.
  const persisted = [];
  t.mock.method(store, 'read', () => db);
  t.mock.method(store, 'write', value => persisted.push(structuredClone(value)));
  const response = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
    }
  };
  settleCustomer({ params: { id: '77' }, body }, response);
  return { status: response.statusCode, payload: response.payload, persisted };
}

function paymentValues(db) {
  return {
    totalSettled: db.customers[0].totalSettled,
    balance: db.customers[0].balance,
    amount: db.settlements[0].amount
  };
}

test('Issue #3: processing browser input "500" persists numeric totals, balance and settlement', t => {
  const db = issueFixture();
  const { status, payload, persisted } = submit(t, db, { amount: '500' });
  const expected = { totalSettled: 1700, balance: 732.01, amount: 500 };
  assert.equal(status, 201);
  assert.equal(persisted.length, 1);
  assert.deepEqual(paymentValues(persisted[0]), expected);
  assert.deepEqual(paymentValues(db), expected);
  assert.equal(payload.settlement.amount, 500);
  assert.equal(ledger.listCustomers(persisted[0])[0].balance, 732.01);
});

for (const { label, amount, numericAmount, totalSettled, balance } of [
  { label: 'numeric integer', amount: 500, numericAmount: 500, totalSettled: 1700, balance: 732.01 },
  { label: 'numeric decimal', amount: 500.25, numericAmount: 500.25, totalSettled: 1700.25, balance: 731.76 },
  { label: 'decimal string', amount: '500.25', numericAmount: 500.25, totalSettled: 1700.25, balance: 731.76 }
]) {
  test(`Payment compatibility: accepts a valid ${label} payment`, t => {
    const db = issueFixture();
    const { status, persisted } = submit(t, db, { amount });
    assert.equal(status, 201);
    assert.equal(persisted.length, 1);
    assert.deepEqual(paymentValues(persisted[0]), { totalSettled, balance, amount: numericAmount });
  });
}

test('Payment compatibility: accepts valid numeric strings in stored ledger totals', t => {
  const db = issueFixture({ openingBalance: '450', totalBilled: '1982.01', totalSettled: '1200' });
  const { status, persisted } = submit(t, db, { amount: 500 });
  assert.equal(status, 201);
  assert.equal(persisted.length, 1);
  assert.deepEqual(paymentValues(persisted[0]), { totalSettled: 1700, balance: 732.01, amount: 500 });
  assert.equal(ledger.listCustomers(persisted[0])[0].balance, 732.01);
});

function assertRejected(t, db, body) {
  const before = structuredClone(db);
  const { status, payload, persisted } = submit(t, db, body);
  assert.deepEqual({
    status,
    hasError: typeof payload.error === 'string' && payload.error.length > 0,
    customerChanged: !isDeepStrictEqual(db.customers, before.customers),
    settlementCount: db.settlements.length,
    nextSettlementId: db.nextSettlementId,
    auditCount: db.auditLog.length,
    writes: persisted.length
  }, {
    status: 400,
    hasError: true,
    customerChanged: false,
    settlementCount: before.settlements.length,
    nextSettlementId: before.nextSettlementId,
    auditCount: before.auditLog.length,
    writes: 0
  });
  assert.deepEqual(db, before);
}

for (const [label, body] of [
  ['missing amount', {}],
  ['empty string', { amount: '' }],
  ['whitespace-only string', { amount: '  ' }],
  ['boolean', { amount: true }],
  ['array', { amount: [500] }],
  ['object', { amount: { value: 500 } }],
  ['nonnumeric string', { amount: 'invalid' }],
  ['NaN number', { amount: NaN }],
  ['infinite number', { amount: Infinity }],
  ['infinite string', { amount: 'Infinity' }],
  ['zero number', { amount: 0 }],
  ['zero string', { amount: '0' }],
  ['negative number', { amount: -500 }],
  ['negative string', { amount: '-500' }]
]) {
  test(`Payment validation: rejects ${label} without side effects`, t => {
    assertRejected(t, issueFixture(), body);
  });
}

test('Payment validation: rejects a finite payment when the resulting settled total overflows', t => {
  const db = issueFixture({ totalBilled: Number.MAX_VALUE, totalSettled: Number.MAX_VALUE, balance: 450 });
  assertRejected(t, db, { amount: Number.MAX_VALUE });
});

test('Payment validation: rejects a payment when the resulting balance is non-finite', t => {
  const db = issueFixture({ totalBilled: 'invalid', balance: null });
  assertRejected(t, db, { amount: 500 });
});

test('Compatibility: settlement updates available credit and the existing credit-limit check still applies', t => {
  const db = issueFixture({ creditLimit: 1000 });
  assert.equal(ledger.chargeOrderToKhata(db, 77, 267.99).ok, false);

  assert.equal(submit(t, db, { amount: '500' }).status, 201);
  assert.equal(ledger.chargeOrderToKhata(db, 77, 267.99).ok, true);
  assert.equal(db.customers[0].balance, 1000);
  assert.equal(ledger.listCustomers(db)[0].balance, 1000);

  const atLimit = structuredClone(db);
  const rejected = ledger.chargeOrderToKhata(db, 77, 0.01);
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /Khata credit limit exceeded/);
  assert.deepEqual(db, atLimit);
});

test('Review regression: string-backed totals support checkout at the credit limit after settlement', t => {
  const db = issueFixture({ openingBalance: '450', totalBilled: '1982.01', totalSettled: '1200', creditLimit: 1000 });
  assert.equal(submit(t, db, { amount: '500' }).status, 201);
  assert.equal(ledger.listCustomers(db)[0].balance, 732.01);

  const accepted = ledger.chargeOrderToKhata(db, 77, 267.99);
  assert.equal(accepted.ok, true, accepted.error);
  assert.equal(accepted.customer.totalBilled, 2250);
  assert.equal(accepted.customer.balance, 1000);
  assert.equal(ledger.listCustomers(db)[0].balance, 1000);

  const atLimit = structuredClone(db);
  const rejected = ledger.chargeOrderToKhata(db, 77, 0.01);
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /Khata credit limit exceeded/);
  assert.deepEqual(db, atLimit);
});

test('Review regression: reversing a charge calculates the balance from string-backed totals', () => {
  const db = issueFixture({ openingBalance: '450', totalBilled: '2250', totalSettled: '1700', balance: 1000 });
  ledger.reverseOrderDebit(db, 77, '267.99');
  assert.equal(db.customers[0].totalBilled, 1982.01);
  assert.equal(db.customers[0].balance, 732.01);
  assert.equal(ledger.listCustomers(db)[0].balance, 732.01);
});

test('Review regression: a charge with an invalid billed result is rejected without mutation', () => {
  const db = issueFixture({ totalBilled: Number.MAX_VALUE, totalSettled: Number.MAX_VALUE });
  const before = structuredClone(db);
  assert.equal(ledger.chargeOrderToKhata(db, 77, Number.MAX_VALUE).ok, false);
  assert.deepEqual(db, before);
});

test('Review regression: an invalid reversal leaves financial state unchanged', () => {
  const db = issueFixture();
  const before = structuredClone(db);
  ledger.reverseOrderDebit(db, 77, Infinity);
  assert.deepEqual(db, before);
});

test('Compatibility: overpayment still records the full amount and leaves a negative balance', t => {
  const db = issueFixture();
  const { status, persisted } = submit(t, db, { amount: '2000' });
  assert.equal(status, 201);
  assert.equal(persisted.length, 1);
  assert.deepEqual(paymentValues(persisted[0]), { totalSettled: 3200, balance: -767.99, amount: 2000 });
});

test('credit-limit enforcement rejects a charge when the persisted rounded balance would exceed the limit', () => {
  const db = issueFixture({ openingBalance: '0.006', totalBilled: '0.006', totalSettled: 0, creditLimit: 1 });
  const before = structuredClone(db);
  const result = ledger.chargeOrderToKhata(db, 77, 0.99);

  assert.equal(result.ok, false);
  assert.match(result.error, /Projected: ₹1\.01/);
  assert.deepEqual(db, before);
});

for (const charge of [0.98, '0.98']) {
  test(`credit-limit enforcement accepts ${JSON.stringify(charge)} when the persisted balance is exactly the limit`, () => {
    const db = issueFixture({ openingBalance: '0.006', totalBilled: '0.006', totalSettled: 0, creditLimit: 1 });
    const result = ledger.chargeOrderToKhata(db, 77, charge);

    assert.equal(result.ok, true);
    assert.equal(result.customer.totalBilled, 0.99);
    assert.equal(result.customer.balance, 1);
    assert.equal(ledger.listCustomers(db)[0].balance, 1);
  });
}
