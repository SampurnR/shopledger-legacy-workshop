const test = require('node:test');
const assert = require('node:assert/strict');
const orders = require('../lib/orders');

test('cancelling an order restores its physical stock', () => {
  const db = {
    products: [{ id: 1, name: 'Rice', stock: 4, reserved: 0 }],
    orders: [{
      id: 1007,
      status: 'pending',
      paymentMode: 'cash',
      items: [{ id: 1, qty: 1 }]
    }]
  };

  const result = orders.cancel(db, 1007, 'test cancellation');

  assert.equal(result.ok, true);
  assert.equal(db.orders[0].status, 'cancelled');
  assert.equal(db.products[0].stock, 5);
});

test('a second cancellation does not restore the same stock twice', () => {
  const db = {
    products: [{ id: 1, name: 'Rice', stock: 4, reserved: 0 }],
    orders: [{
      id: 1007,
      status: 'pending',
      paymentMode: 'cash',
      items: [{ id: 1, qty: 1 }]
    }]
  };

  orders.cancel(db, 1007, 'test cancellation');
  const secondResult = orders.cancel(db, 1007, 'duplicate cancellation');

  assert.equal(secondResult.ok, false);
  assert.equal(db.products[0].stock, 5);
});
