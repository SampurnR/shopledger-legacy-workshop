const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

// Match the order route's item shape and reserve-before-add sequence entirely in memory.
function pendingOrderFixture(paymentMode = 'cash') {
  const db = {
    nextOrderId: 1001,
    products: [{ id: 1, name: 'Rice', stock: 10, reserved: 3 }],
    orders: [],
    customers: [{ id: 1, openingBalance: 20, totalBilled: 100, totalSettled: 10, balance: 110 }]
  };
  const items = [{ id: 1, name: 'Rice', price: 50, qty: 2 }];
  inventory.reserve(db.products, items);
  const order = orders.add(db, {
    status: 'pending', paymentMode, customerId: 1, items,
    subtotal: 100, discount: 0, tax: 0, total: 100
  });
  return { db, order };
}

test('cancelling a pending order changes status and restores inventory', () => {
  const { db, order } = pendingOrderFixture();
  assert.equal(db.products[0].stock, 8);
  assert.equal(inventory.getSellableStock(db.products[0]), 5);
  const result = orders.cancel(db, order.id, 'Customer cancelled');
  assert.equal(result.ok, true);
  assert.equal(result.order, order);
  assert.equal(order.status, 'cancelled');
  assert.equal(order.cancelReason, 'Customer cancelled');
  assert.match(order.cancelledAt, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.deepEqual(db.products, [{ id: 1, name: 'Rice', stock: 10, reserved: 3 }]);
  assert.equal(inventory.getSellableStock(db.products[0]), 7);
});

test('adding an order allocates its ID and preserves pending status and item IDs', () => {
  const { db, order } = pendingOrderFixture();
  assert.equal(order.id, 1001);
  assert.equal(db.nextOrderId, 1002);
  assert.equal(db.orders[0], order);
  assert.equal(order.status, 'pending');
  assert.equal(order.items[0].id, 1);
  assert.equal(orders.get(db, '1001'), order);
});

test('cancellation reverses a khata debit and rejects a repeated cancellation without further changes', () => {
  const { db, order } = pendingOrderFixture('khata');
  assert.equal(orders.cancel(db, order.id).ok, true);
  assert.equal(db.customers[0].totalBilled, 0);
  assert.equal(db.customers[0].balance, 10);
  const afterCancellation = structuredClone(db);
  assert.deepEqual(orders.cancel(db, order.id), {
    ok: false, error: 'Order #1001 is already cancelled'
  });
  assert.deepEqual(db, afterCancellation);
});

test('cancelling an unknown order returns an error without mutating the fixture', () => {
  const { db } = pendingOrderFixture();
  const before = structuredClone(db);
  assert.deepEqual(orders.cancel(db, 9999), { ok: false, error: 'Order not found' });
  assert.deepEqual(db, before);
});
