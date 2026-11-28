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

test('two lines for the same SKU can use exactly the sellable stock', () => {
  const product = { id: 2, stock: 6, reserved: 3 };
  const items = [{ id: product.id, qty: 1 }, { id: product.id, qty: 2 }];

  assert.deepEqual(inventory.check([product], items), { ok: true });
  inventory.reserve([product], items);

  assert.equal(product.stock, 3);
  assert.equal(product.reserved, 3);
  assert.equal(inventory.getSellableStock(product), 0);
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

test('cancelling the same order twice restores its stock exactly once', () => {
  const product = { id: 2, stock: 6, reserved: 3 };
  const items = [{ id: product.id, qty: 2 }];
  const db = { products: [product], orders: [], nextOrderId: 1007 };
  inventory.reserve(db.products, items);
  const order = orders.add(db, { status: 'pending', items });

  assert.equal(orders.cancel(db, order.id).ok, true);
  assert.equal(product.stock, 6);
  assert.deepEqual(orders.cancel(db, order.id), {
    ok: false,
    error: 'Order #1007 is already cancelled'
  });
  assert.equal(product.stock, 6);
  assert.equal(product.reserved, 3);
});

test('releasing a quote reduces reservations without adding physical stock', () => {
  const product = { id: 2, stock: 4, reserved: 3 };

  inventory.release([product], [{ productId: product.id, qty: 2 }]);

  assert.equal(product.stock, 4);
  assert.equal(product.reserved, 1);
  assert.equal(inventory.getSellableStock(product), 3);
});

test('cancelling an order does not restock a productId-only line', () => {
  const product = { id: 2, stock: 4, reserved: 3 };
  const db = { products: [product], orders: [], nextOrderId: 1007 };
  const order = orders.add(db, {
    status: 'pending',
    items: [{ productId: product.id, qty: 2 }]
  });

  assert.deepEqual(orders.cancel(db, order.id), { ok: true, order });
  assert.equal(order.status, 'cancelled');
  assert.equal(product.stock, 4);
  assert.equal(product.reserved, 3);
});

test('cancelling a Khata order restores available catalog items and reverses the debit', () => {
  const product = { id: 2, stock: 4, reserved: 3 };
  const customer = { id: 1, openingBalance: 50, totalBilled: 125, totalSettled: 25 };
  const db = { products: [product], customers: [customer], orders: [], nextOrderId: 1007 };
  const order = orders.add(db, {
    status: 'pending',
    paymentMode: 'khata',
    customerId: customer.id,
    total: 75,
    items: [{ id: 99, qty: 1 }, { id: product.id, qty: 2 }]
  });

  assert.equal(orders.cancel(db, order.id).ok, true);
  assert.equal(order.status, 'cancelled');
  assert.equal(product.stock, 6);
  assert.equal(product.reserved, 3);
  assert.equal(customer.totalBilled, 50);
  assert.equal(customer.balance, 75);
});

test('cancelling an unknown order leaves inventory intact', () => {
  const product = { id: 2, stock: 4, reserved: 3 };
  const db = { products: [product], orders: [] };

  assert.deepEqual(orders.cancel(db, 1007), { ok: false, error: 'Order not found' });
  assert.deepEqual(product, { id: 2, stock: 4, reserved: 3 });
});

test('inventory summary uses sellable units for alerts and physical units for valuation', () => {
  const products = [
    { stock: 3, reserved: 3, price: 10 },
    { stock: 12, reserved: 2, price: 20 },
    { stock: 5, reorderLevel: 3, price: 30 }
  ];

  assert.deepEqual(inventory.summarize(products), {
    totalSkus: 3,
    outOfStockCount: 1,
    lowStockCount: 1,
    totalValuation: 420
  });
});

test('inventory rejects unknown SKUs and skips them during stock adjustments', () => {
  const product = { id: 2, stock: 4, reserved: 3 };
  const products = [product];
  const items = [{ id: 99, qty: 1 }];

  assert.deepEqual(inventory.check(products, items), { ok: false, msg: 'Unknown product 99' });
  inventory.reserve(products, items);
  inventory.release(products, [{ productId: 99, qty: 1 }]);
  assert.deepEqual(product, { id: 2, stock: 4, reserved: 3 });
});

test('inventory treats omitted stock, reservations, and prices as zero', () => {
  const product = { id: 2 };
  assert.equal(inventory.getSellableStock(inventory.find([product], 99)), 0);
  assert.deepEqual(inventory.summarize([product]), {
    totalSkus: 1,
    outOfStockCount: 1,
    lowStockCount: 0,
    totalValuation: 0
  });

  inventory.release([product], [{ productId: product.id, qty: 1 }]);
  inventory.restock([product], [{ id: product.id, qty: 2 }]);
  assert.equal(product.reserved, 0);
  assert.equal(product.stock, 2);
});
