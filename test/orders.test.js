const assert = require('node:assert/strict');
const { test } = require('node:test');
const orders = require('../lib/orders');

function pendingOrderFixture() {
  return {
    products: [
      { id: 6, stock: 1, reserved: 0 },
      { id: 4, stock: 7, reserved: 2 }
    ],
    orders: [{
      id: 1007,
      status: 'pending',
      paymentMode: 'cash',
      items: [{ id: 6, qty: 2 }, { id: 4, qty: 2 }]
    }]
  };
}

test('cancellation records the status and operator reason', () => {
  const db = pendingOrderFixture();

  const result = orders.cancel(db, 1007, 'Characterization test');

  assert.equal(result.ok, true);
  assert.equal(db.orders[0].status, 'cancelled');
  assert.equal(db.orders[0].cancelReason, 'Characterization test');
});

test('rejects repeat cancellation and leaves the resulting stock counts intact', () => {
  const db = pendingOrderFixture();
  assert.equal(orders.cancel(db, 1007).ok, true);
  const productsAfterCancellation = structuredClone(db.products);

  const result = orders.cancel(db, 1007);

  assert.deepEqual(result, { ok: false, error: 'Order #1007 is already cancelled' });
  assert.deepEqual(db.products, productsAfterCancellation);
});
