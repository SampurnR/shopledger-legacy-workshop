const assert = require('node:assert/strict');
const test = require('node:test');
const orders = require('../lib/orders');
const store = require('../lib/store');
const router = require('../routes/orders');

const cancellationRoute = router.stack.find(layer =>
  layer.route?.path === '/orders/:id/cancel' && layer.route.methods.post
);
const cancelOrder = cancellationRoute.route.stack[0].handle;

function fixture(total = 100) {
  return {
    customers: [{ id: 7, openingBalance: '10', totalBilled: '100', totalSettled: '20', balance: 90 }],
    products: [{ id: 5, stock: 12, reserved: 4 }],
    orders: [{
      id: 1001, status: 'completed', paymentMode: 'khata', customerId: 7,
      total, items: [{ productId: 5, qty: 2 }]
    }],
    settlements: [{ id: 501, customerId: 7, amount: 20 }],
    nextOrderId: 1002,
    nextSettlementId: 502,
    auditLog: [{ action: 'ORDER_CREATED' }]
  };
}

function submitCancellation(t, db) {
  const persisted = [];
  t.mock.method(store, 'read', () => db);
  t.mock.method(store, 'write', snapshot => persisted.push(structuredClone(snapshot)));
  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
    }
  };
  cancelOrder({ params: { id: '1001' }, body: { reason: 'Synthetic cancellation' } }, response);
  return { status: response.statusCode, payload: response.payload, persisted };
}

test('cancellation rejects invalid Khata reversal without changing any loaded state', () => {
  const db = fixture('bad');
  const before = structuredClone(db);

  assert.equal(orders.cancel(db, 1001).ok, false);
  assert.deepEqual(db, before);
});

test('the cancellation route rejects invalid Khata reversal without auditing or persisting', t => {
  const db = fixture('bad');
  const before = structuredClone(db);
  const { status, payload, persisted } = submitCancellation(t, db);

  assert.equal(status, 400);
  assert.equal(typeof payload.error, 'string');
  assert.deepEqual(db, before);
  assert.deepEqual(persisted, []);
});

test('cancellation leaves the loaded snapshot intact if inventory release cannot finish', t => {
  const db = fixture();
  db.orders[0].items.push(null);
  const before = structuredClone(db);
  const { status, persisted } = submitCancellation(t, db);

  assert.equal(status, 400);
  assert.deepEqual(db, before);
  assert.deepEqual(persisted, []);
});

test('cancellation rejects a non-finite staged reservation without changing or writing state', t => {
  const db = fixture();
  db.orders[0].items.push({ productId: 5, qty: 'invalid quantity' });
  const before = structuredClone(db);
  const { status, payload, persisted } = submitCancellation(t, db);

  assert.equal(status, 400);
  assert.match(payload.error, /Invalid inventory reservation/);
  assert.deepEqual(db, before);
  assert.deepEqual(persisted, []);
});

test('valid Khata cancellation keeps the existing reservation release and debit reversal effects', t => {
  const db = fixture('100');
  const { status, payload, persisted } = submitCancellation(t, db);

  assert.equal(status, 200);
  assert.equal(payload.status, 'cancelled');
  assert.equal(payload.cancelReason, 'Synthetic cancellation');
  assert.match(payload.cancelledAt, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.deepEqual(db.products, [{ id: 5, stock: 12, reserved: 2 }]);
  assert.equal(db.customers[0].totalBilled, 0);
  assert.equal(db.customers[0].balance, -10);
  assert.equal(db.nextOrderId, 1002);
  assert.equal(db.nextSettlementId, 502);
  assert.deepEqual(db.settlements, [{ id: 501, customerId: 7, amount: 20 }]);
  assert.equal(db.auditLog[0].action, 'ORDER_CANCELLED');
  assert.deepEqual(persisted, [db]);
});
