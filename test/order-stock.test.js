const assert = require('node:assert/strict');
const { test } = require('node:test');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

function createDb() {
  return {
    products: [{ id: 1, name: 'Rice', stock: 5, reserved: 2 }],
    orders: [],
    nextOrderId: 1001
  };
}

test('ordering fewer than the sellable units deducts physical stock', () => {
  const { products } = createDb();
  const [product] = products;
  const items = [{ id: product.id, qty: 2 }];

  assert.equal(inventory.getSellableStock(product), 3);
  assert.deepEqual(inventory.check(products, items), { ok: true });
  inventory.reserve(products, items);

  assert.equal(product.stock, 3);
  assert.equal(product.reserved, 2);
  assert.equal(inventory.getSellableStock(product), 1);
});

test('ordering exactly the sellable quantity passes the stock check', () => {
  const { products } = createDb();

  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 3 }]), { ok: true });
});

test('stock check rejects repeated product lines that together exceed sellable stock', () => {
  const { products } = createDb();
  const items = [{ id: 1, qty: 2 }, { id: '1', qty: 2 }];

  assert.deepEqual(inventory.check(products, items), {
    ok: false,
    msg: 'Rice is out of stock (3 sellable available)'
  });
});

test('cancelling productId-based lines restores physical stock once', () => {
  const db = createDb();
  const [product] = db.products;
  inventory.reserve(db.products, [{ id: product.id, qty: 1 }]);
  const order = orders.add(db, { items: [{ productId: product.id, qty: 1 }] });

  assert.equal(orders.cancel(db, order.id).ok, true);
  assert.equal(product.stock, 5);
  assert.equal(product.reserved, 2);
  assert.equal(inventory.getSellableStock(product), 3);

  assert.deepEqual(orders.cancel(db, order.id), {
    ok: false,
    error: `Order #${order.id} is already cancelled`
  });
  assert.equal(product.stock, 5);
});

test('buying the last sellable unit consumes it and preserves wholesale reservations', () => {
  const { products } = createDb();
  const [product] = products;
  inventory.reserve(products, [{ id: product.id, qty: 2 }]);
  const items = [{ id: product.id, qty: 1 }];

  assert.deepEqual(inventory.check(products, items), { ok: true });
  inventory.reserve(products, items);
  assert.equal(product.stock, 2);
  assert.equal(product.reserved, 2);
  assert.equal(inventory.getSellableStock(product), 0);
});

test('cancelling a purchase restores physical stock and preserves wholesale reservations', () => {
  const db = createDb();
  const [product] = db.products;
  const items = [{ id: product.id, qty: 2 }];
  inventory.reserve(db.products, items);
  const order = orders.add(db, { items });

  assert.equal(orders.cancel(db, order.id, 'Customer request').ok, true);
  assert.equal(order.status, 'cancelled');
  assert.equal(order.cancelReason, 'Customer request');
  assert.equal(product.stock, 5);
  assert.equal(product.reserved, 2);
  assert.equal(inventory.getSellableStock(product), 3);
});
