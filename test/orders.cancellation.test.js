const test = require('node:test');
const assert = require('node:assert/strict');
const orders = require('../lib/orders');

function fixture(status = 'pending', paymentMode = 'khata') {
  return {
    products: [{ id: 1, name: 'Fixture product', stock: 8, reserved: 3 }],
    orders: [{ id: 1007, status, paymentMode, customerId: 1, total: 200,
      items: [{ id: 1, qty: 2 }] }],
    customers: [{ id: 1, name: 'Fixture customer', openingBalance: 100,
      totalBilled: 500, totalSettled: 50, balance: 550 }]
  };
}

test('cancellation updates status, reason, and date and returns the same order', () => {
  const db = fixture();
  const result = orders.cancel(db, '1007', 'Customer requested cancellation');
  assert.equal(result.ok, true);
  assert.equal(result.order, db.orders[0]);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(result.order.cancelReason, 'Customer requested cancellation');
  assert.match(result.order.cancelledAt, /^\d{2}\/\d{2}\/\d{4}$/);
});

test('cancelling a pending order restores physical stock and preserves holds', () => {
  const db = fixture();
  orders.cancel(db, 1007, 'Fixture cancellation');
  assert.equal(db.products[0].stock, 10);
  assert.equal(db.products[0].reserved, 3);
});

test('khata cancellation reverses the order debit and preserves settled payments', () => {
  const db = fixture();
  orders.cancel(db, 1007);
  assert.equal(db.customers[0].totalBilled, 300);
  assert.equal(db.customers[0].totalSettled, 50);
  assert.equal(db.customers[0].balance, 350);
  assert.equal(db.orders[0].cancelReason, 'Cancelled by operator');
});

test('completed cash orders can be cancelled without changing customer credit', () => {
  const db = fixture('completed', 'cash');
  const customerBefore = { ...db.customers[0] };
  assert.equal(orders.cancel(db, 1007).ok, true);
  assert.deepEqual(db.customers[0], customerBefore);
});

test('a second cancellation is rejected without repeating stock or ledger changes', () => {
  const db = fixture();
  orders.cancel(db, 1007);
  const afterFirst = structuredClone(db);
  assert.deepEqual(orders.cancel(db, 1007), {
    ok: false, error: 'Order #1007 is already cancelled'
  });
  assert.deepEqual(db, afterFirst);
});

test('cancelling an unknown order leaves the in-memory database unchanged', () => {
  const db = fixture();
  const before = structuredClone(db);
  assert.deepEqual(orders.cancel(db, 99), { ok: false, error: 'Order not found' });
  assert.deepEqual(db, before);
});
