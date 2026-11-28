const assert = require('node:assert/strict');
const test = require('node:test');
const ledger = require('../lib/ledger');
const store = require('../lib/store');
const router = require('../routes/customers');

const settlementRoute = router.stack.find(layer =>
  layer.route?.path === '/customers/:id/settle' && layer.route.methods.post
);
const settleCustomer = settlementRoute.route.stack[0].handle;

function fixture() {
  return {
    customers: [
      { id: 7, name: 'Asha Rao', openingBalance: 250, totalBilled: 2250, totalSettled: 1200, balance: 1300 }
    ],
    settlements: [{ id: 500, customerId: 7, amount: 1200 }],
    nextSettlementId: 501,
    auditLog: [{ action: 'ORDER_CREATED' }]
  };
}

function submitSettlement(t, db, body, id = '7') {
  const read = t.mock.method(store, 'read', () => db);
  const write = t.mock.method(store, 'write', () => {});
  const response = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
    }
  };

  settleCustomer({ params: { id }, body }, response);
  assert.equal(read.mock.callCount(), 1);
  return { status: response.statusCode, payload: response.payload, writes: write.mock.calls };
}

test('numeric settlement updates the balance, prepends a record, increments the counter and audits', t => {
  const db = fixture();
  const { status, payload, writes } = submitSettlement(t, db, {
    amount: 500, mode: 'cash', note: 'Counter payment'
  });

  assert.equal(status, 201);
  assert.equal(payload.ok, true);
  assert.strictEqual(payload.customer, db.customers[0]);
  assert.equal(payload.customer.totalSettled, 1700);
  assert.equal(payload.customer.balance, 800);
  assert.equal(ledger.listCustomers(db)[0].balance, 800);
  assert.match(payload.settlement.date, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.deepEqual(payload.settlement, {
    id: 501,
    customerId: 7,
    customerName: 'Asha Rao',
    date: payload.settlement.date,
    amount: 500,
    mode: 'cash',
    note: 'Counter payment'
  });
  assert.strictEqual(db.settlements[0], payload.settlement);
  assert.deepEqual(db.settlements[1], { id: 500, customerId: 7, amount: 1200 });
  assert.equal(db.nextSettlementId, 502);
  assert.deepEqual(db.auditLog.map(({ action, details }) => ({ action, details })), [
    { action: 'KHATA_SETTLEMENT', details: 'Asha Rao settled ₹500 via CASH' },
    { action: 'ORDER_CREATED', details: undefined }
  ]);
  assert.equal(new Date(db.auditLog[0].ts).toISOString(), db.auditLog[0].ts);
  assert.equal(writes.length, 1);
  assert.strictEqual(writes[0].arguments[0], db);
});

test('browser string payment updates the total and balance numerically', t => {
  const db = fixture();
  const { status, payload, writes } = submitSettlement(t, db, { amount: '500' });

  assert.equal(status, 201);
  assert.equal(payload.ok, true);
  assert.equal(payload.customer.totalSettled, 1700);
  assert.equal(payload.customer.balance, 800);
  assert.equal(ledger.listCustomers(db)[0].balance, 800);
  assert.equal(db.settlements[0].amount, 500);
  assert.equal(db.settlements[0].mode, 'upi');
  assert.equal(db.settlements[0].note, 'Khata settlement');
  assert.equal(db.auditLog[0].details, 'Asha Rao settled ₹500 via UPI');
  assert.equal(writes.length, 1);
});

test('settlement rejects an unknown customer without mutating, auditing or writing', t => {
  const db = fixture();
  const result = submitSettlement(t, db, { amount: 500 }, '999');
  assert.deepEqual(result, { status: 400, payload: { error: 'Customer not found' }, writes: [] });
  assert.deepEqual(db, fixture());
});

for (const amount of [undefined, '', 0, '0', -1, '-1']) {
  test(`settlement rejects amount ${JSON.stringify(amount)} without side effects`, t => {
    const db = fixture();
    const result = submitSettlement(t, db, { amount });
    assert.deepEqual(result, {
      status: 400,
      payload: { error: 'Settlement amount must be greater than zero' },
      writes: []
    });
    assert.deepEqual(db, fixture());
  });
}
