const test = require('node:test');
const assert = require('node:assert/strict');
const orders = require('../lib/orders');
const dates = require('../lib/dates');

// A synthetic pending order in the same shape used by the order route.
// Fixtures are built here; neither store nor the on-disk database is imported.
function pendingOrderDb() {
  return {
    products: [
      { id: 6, name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 },
      { id: 4, name: 'Sunflower Oil 1L', stock: 12, reserved: 4 }
    ],
    customers: [{ id: 4, openingBalance: 1200, totalBilled: 1407, totalSettled: 1000, balance: 1607 }],
    orders: [{
      id: 1007, status: 'pending', paymentMode: 'khata', customerId: 4,
      items: [{ id: 6, qty: 2 }, { id: 4, qty: 2 }], total: 1407
    }]
  };
}

test('cancelling a pending order restores stock, preserves holds, and reverses khata', (t) => {
  t.mock.method(dates, 'today', () => '15/11/2026');
  const db = pendingOrderDb();
  const restoredProducts = structuredClone(db.products);
  restoredProducts[0].stock += 2;
  restoredProducts[1].stock += 2;
  const itemsBefore = structuredClone(db.orders[0].items);

  const result = orders.cancel(db, '1007', 'Cancelled from Order Register');

  assert.equal(result.ok, true);
  assert.strictEqual(result.order, db.orders[0]);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(result.order.cancelledAt, '15/11/2026');
  assert.equal(result.order.cancelReason, 'Cancelled from Order Register');
  assert.deepEqual(result.order.items, itemsBefore);
  assert.deepEqual(db.products, restoredProducts);
  assert.deepEqual(db.customers[0], {
    id: 4, openingBalance: 1200, totalBilled: 0, totalSettled: 1000, balance: 200
  });
});

test('repeat cancellation is refused without another credit reversal or inventory change', () => {
  const db = pendingOrderDb();
  orders.cancel(db, 1007, 'First cancellation');
  const before = structuredClone(db);
  assert.deepEqual(orders.cancel(db, 1007, 'Second cancellation'), {
    ok: false, error: 'Order #1007 is already cancelled'
  });
  assert.deepEqual(db, before);
});

test('cancelling an unknown order returns an error without changing data', () => {
  const db = pendingOrderDb();
  const before = structuredClone(db);
  assert.deepEqual(orders.cancel(db, 9999, 'Missing order'), {
    ok: false, error: 'Order not found'
  });
  assert.deepEqual(db, before);
});

test('a completed cash order can also be cancelled, restoring stock without changing khata', () => {
  const db = pendingOrderDb();
  db.orders[0].status = 'completed';
  db.orders[0].paymentMode = 'cash';
  const restoredProducts = structuredClone(db.products);
  restoredProducts[0].stock += 2;
  restoredProducts[1].stock += 2;
  const customersBefore = structuredClone(db.customers);
  const result = orders.cancel(db, 1007);
  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(result.order.cancelReason, 'Cancelled by operator');
  assert.deepEqual(db.products, restoredProducts);
  assert.deepEqual(db.customers, customersBefore);
});
