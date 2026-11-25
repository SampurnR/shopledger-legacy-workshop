const test = require('node:test');
const assert = require('node:assert/strict');
const orders = require('../lib/orders');

test('cancelling an order restores its stock', () => {
  const db = {
    nextOrderId: 1001,
    orders: [],
    products: [
      { id: 'DRY-001', stock: 0, reserved: 0 }
    ],
    customers: []
  };

  const order = orders.add(db, {
    items: [{ id: 'DRY-001', qty: 1 }],
    paymentMode: 'cash',
    total: 100
  });

  const result = orders.cancel(db, order.id, 'Test cancellation');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(db.products[0].stock, 1);
});