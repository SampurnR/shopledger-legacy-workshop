'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

function product(id, sku, stock, reserved) {
  return { id, sku, name: sku, stock, reserved };
}

for (const [name, stock, reserved, qty, expected] of [
  ['DRY-001 last physical unit', 1, 0, 1, true],
  ['SPC-001 last sellable unit with wholesale holds', 4, 3, 1, true],
  ['exact remaining sellable quantity', 9, 2, 7, true],
  ['quantity exceeding sellable stock', 4, 3, 2, false],
  ['zero sellable stock', 3, 3, 1, false]
]) {
  test('stock check: ' + name, () => {
    const products = [product(6, name, stock, reserved)];
    const before = structuredClone(products);
    const result = inventory.check(products, [{ id: 6, qty }]);
    assert.equal(result.ok, expected, `physical=${stock}, reserved=${reserved}, requested=${qty}: ${result.msg || 'accepted'}`);
    assert.deepEqual(products, before, 'validation must not mutate stock');
  });
}

// Representative #1007 quantities from the issue, not copied persisted data.
// Replay the actual creation accounting: reserve() deducts physical units,
// then add() records the order. The starting quantities leave ample stock.
function lifecycle(status = 'pending') {
  const db = {
    nextOrderId: 1007,
    products: [product(6, 'DRY-001', 8, 1), product(4, 'OIL-001', 12, 3), product(99, 'UNRELATED', 20, 4)],
    orders: []
  };
  const items = [{ id: 6, sku: 'DRY-001', qty: 2 }, { id: 4, sku: 'OIL-001', qty: 2 }];
  assert.equal(inventory.check(db.products, items).ok, true);
  inventory.reserve(db.products, items);
  orders.add(db, { items, status, paymentMode: 'cash', total: 1280 });
  return db;
}

test('creation deducts physical stock for pending and completed orders, preserving wholesale holds', () => {
  for (const status of ['pending', 'completed']) {
    const db = lifecycle(status);
    assert.equal(db.orders[0].status, status);
    assert.deepEqual(db.products.map(p => [p.stock, p.reserved, inventory.getSellableStock(p)]),
      [[6, 1, 5], [10, 3, 7], [20, 4, 16]]);
  }
});

test('cancelling pending #1007 restores two ghee jars and two oil bottles to physical stock', () => {
  const db = lifecycle();
  const result = orders.cancel(db, 1007, 'Regression check');
  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(result.order.cancelReason, 'Regression check');
  assert.deepEqual(db.products.map(p => [p.stock, p.reserved, inventory.getSellableStock(p)]),
    [[8, 1, 7], [12, 3, 9], [20, 4, 16]], 'undo physical deduction without releasing unrelated wholesale holds');
});

test('repeated cancellation is rejected and does not change stock a second time', () => {
  const db = lifecycle();
  assert.equal(orders.cancel(db, 1007).ok, true);
  const afterFirst = structuredClone(db);
  const second = orders.cancel(db, 1007);
  assert.equal(second.ok, false);
  assert.match(second.error, /already cancelled/);
  assert.deepEqual(db, afterFirst);
});

test('cancelling an unknown order fails without changing inventory or orders', () => {
  const db = lifecycle();
  const before = structuredClone(db);
  assert.deepEqual(orders.cancel(db, 9999), { ok: false, error: 'Order not found' });
  assert.deepEqual(db, before);
});

test('cancelling #1007 leaves unrelated products unchanged', () => {
  const db = lifecycle();
  const unrelated = structuredClone(db.products[2]);
  assert.equal(orders.cancel(db, 1007).ok, true);
  assert.deepEqual(db.products[2], unrelated);
});
