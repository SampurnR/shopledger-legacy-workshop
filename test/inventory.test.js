const assert = require('node:assert/strict');
const test = require('node:test');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

for (const { product, qty } of [
  { product: { id: 1, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 }, qty: 1 },
  { product: { id: 2, sku: 'SPC-001', name: 'Byadgi Chilli Powder', stock: 4, reserved: 3 }, qty: 1 },
  { product: { id: 3, sku: 'TEST-003', name: 'Test product', stock: 8, reserved: 3 }, qty: 5 }
]) {
  test(`${product.sku} allows a sale for exactly ${qty} sellable`, () => {
    assert.equal(inventory.getSellableStock(product), qty);
    assert.deepEqual(inventory.check([product], [{ id: product.id, qty }]), { ok: true });
    inventory.reserve([product], [{ id: product.id, qty }]);
    assert.equal(product.stock, product.reserved);
    assert.equal(inventory.getSellableStock(product), 0);
  });
}

test('a sale above sellable stock is rejected', () => {
  const product = { id: 2, name: 'Byadgi Chilli Powder', stock: 4, reserved: 3 };

  assert.deepEqual(inventory.check([product], [{ id: product.id, qty: 2 }]), {
    ok: false,
    msg: 'Byadgi Chilli Powder is out of stock (1 sellable available)'
  });
});

test('two lines for the last sellable unit are rejected together', () => {
  const product = { id: 2, name: 'Byadgi Chilli Powder', stock: 4, reserved: 3 };
  const items = [{ id: 2, qty: 1 }, { id: 2, qty: 1 }];

  assert.deepEqual(inventory.check([product], items), {
    ok: false,
    msg: 'Byadgi Chilli Powder is out of stock (1 sellable available)'
  });
});

test('a sale below sellable stock deducts physical units and preserves reservations', () => {
  const product = { id: 2, name: 'Byadgi Chilli Powder', stock: 6, reserved: 3 };
  const items = [{ id: product.id, qty: 2 }];

  assert.deepEqual(inventory.check([product], items), { ok: true });
  inventory.reserve([product], items);

  assert.equal(product.stock, 4);
  assert.equal(product.reserved, 3);
  assert.equal(inventory.getSellableStock(product), 1);
});

test('cancelling pending order #1007 restores physical stock and preserves reservations', () => {
  const product = { id: 2, stock: 6, reserved: 3 };
  const items = [{ id: product.id, qty: 2 }];
  const db = { products: [product], orders: [], nextOrderId: 1007 };
  inventory.reserve(db.products, items);
  const order = orders.add(db, { status: 'pending', items });
  const reason = 'Cancelled from Order Register';

  const result = orders.cancel(db, '1007', reason);

  assert.deepEqual(result, { ok: true, order });
  assert.equal(order.status, 'cancelled');
  assert.equal(order.cancelReason, reason);
  assert.match(order.cancelledAt, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.equal(product.stock, 6);
  assert.equal(product.reserved, 3);
  assert.equal(inventory.getSellableStock(product), 3);
});

test('release also restores physical stock for lines with productId', () => {
  const product = { id: 2, stock: 4, reserved: 3 };

  inventory.release([product], [{ productId: product.id, qty: 2 }]);

  assert.equal(product.stock, 6);
  assert.equal(product.reserved, 3);
  assert.equal(inventory.getSellableStock(product), 3);
});
