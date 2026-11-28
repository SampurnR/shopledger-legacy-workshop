const assert = require('node:assert/strict');
const test = require('node:test');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

const exactStockCases = [
  { id: 1, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0, sellable: 1 },
  { id: 2, sku: 'SPC-001', name: 'Byadgi Chilli Powder', stock: 4, reserved: 3, sellable: 1 },
  { id: 3, sku: 'TEST-003', name: 'Test item', stock: 8, reserved: 2, sellable: 6 }
];

for (const { sellable, ...product } of exactStockCases) {
  test(product.sku + ' accepts the exact sellable quantity', () => {
    assert.equal(inventory.getSellableStock(product), sellable);
    assert.deepEqual(inventory.check([product], [{ id: product.id, qty: sellable }]), { ok: true });
  });
}

test('stock check accepts a quantity below sellable stock and rejects one above it', () => {
  const product = { id: 1, name: 'Test item', stock: 8, reserved: 2 };

  assert.deepEqual(inventory.check([product], [{ id: 1, qty: 5 }]), { ok: true });
  assert.deepEqual(inventory.check([product], [{ id: 1, qty: 7 }]), {
    ok: false,
    msg: 'Test item is out of stock (6 sellable available)'
  });
});

test('stock checks the combined quantity when cart lines repeat a product', () => {
  const product = { id: 1, name: 'Test item', stock: 4, reserved: 3 };

  assert.deepEqual(inventory.check([product], [{ id: 1, qty: 1 }, { id: '1', qty: 1 }]), {
    ok: false,
    msg: 'Test item is out of stock (1 sellable available)'
  });
});

test('cancelling pending order #1007 restores all deducted stock once', () => {
  const first = { id: 1, stock: 8, reserved: 2 };
  const second = { id: 2, stock: 5, reserved: 1 };
  const db = { products: [first, second], orders: [], nextOrderId: 1007 };
  // Checkout commits physical stock and saves order lines keyed by id.
  const items = [{ id: 1, qty: 2 }, { id: 2, qty: 1 }];
  assert.deepEqual(inventory.check(db.products, items), { ok: true });
  inventory.reserve(db.products, items);
  const order = orders.add(db, { items, status: 'pending', paymentMode: 'cash' });

  assert.equal(order.id, 1007);
  assert.equal(order.status, 'pending');
  assert.deepEqual([first.stock, second.stock], [6, 4]);

  const result = orders.cancel(db, '1007', 'Cancelled from Order History');

  assert.equal(result.ok, true);
  assert.equal(result.order, order);
  assert.equal(order.status, 'cancelled');
  assert.equal(order.cancelReason, 'Cancelled from Order History');
  assert.deepEqual([first.stock, second.stock], [8, 5]);
  assert.deepEqual([first.reserved, second.reserved], [2, 1]);
  assert.deepEqual(db.products.map(inventory.getSellableStock), [6, 4]);

  assert.deepEqual(orders.cancel(db, '1007'), {
    ok: false,
    error: 'Order #1007 is already cancelled'
  });
  assert.deepEqual([first.stock, second.stock], [8, 5]);
});

test('CURRENT BEHAVIOUR: release with productId reduces reserved units without restoring physical stock', () => {
  const product = { id: 1, stock: 6, reserved: 3 };

  inventory.release([product], [{ productId: 1, qty: 2 }]);

  assert.equal(product.stock, 6);
  assert.equal(product.reserved, 1);
});
