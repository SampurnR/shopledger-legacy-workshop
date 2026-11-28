const assert = require('node:assert/strict');
const test = require('node:test');
const orders = require('../lib/orders');

function pendingOrder() {
  return {
    products: [
      { id: 6, sku: 'DRY-001', stock: 1, reserved: 0 },
      { id: 4, sku: 'OIL-001', stock: 22, reserved: 4 },
      { id: 11, sku: 'SPC-001', stock: 4, reserved: 3 }
    ],
    orders: [{
      id: 1007,
      status: 'pending',
      paymentMode: 'khata',
      customerId: 4,
      total: 1407,
      items: [{ id: 6, qty: 2 }, { id: 4, qty: 2 }]
    }],
    customers: [{ id: 4, openingBalance: 100, totalBilled: 2000, totalSettled: 50, balance: 2050 }]
  };
}

test('cancelling pending order #1007 restores both lines without changing wholesale holds', () => {
  const db = pendingOrder();
  const result = orders.cancel(db, 1007, 'Cancelled at order desk');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(result.order.cancelReason, 'Cancelled at order desk');
  assert.deepEqual(db.products.map(({ sku, stock, reserved }) => [sku, stock, reserved]), [
    ['DRY-001', 3, 0], ['OIL-001', 24, 4], ['SPC-001', 4, 3]
  ]);
});

test('repeated cancellation leaves physical stock, wholesale holds, and khata unchanged', () => {
  const db = pendingOrder();
  assert.equal(orders.cancel(db, 1007).ok, true);
  assert.equal(db.customers[0].totalBilled, 593);
  assert.equal(db.customers[0].balance, 643);
  const afterFirstCancellation = structuredClone(db);

  assert.deepEqual(orders.cancel(db, 1007), { ok: false, error: 'Order #1007 is already cancelled' });
  assert.deepEqual(db, afterFirstCancellation);
});
