const assert = require('node:assert/strict');
const test = require('node:test');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

test('allows the exact sellable quantity and protects wholesale reservations', () => {
  const products = [{ id: 1, name: 'Chilli powder', stock: 4, reserved: 3 }];

  assert.equal(inventory.getSellableStock(products[0]), 1);
  assert.equal(inventory.check(products, [{ id: 1, qty: 2 }]).ok, false);
  assert.equal(inventory.check(products, [{ id: 1, qty: 1 }]).ok, true);
});

test('cancelling a pending order restores physical stock once and keeps wholesale reservations', () => {
  const product = { id: 1, stock: 5, reserved: 2 };
  const db = { products: [product], orders: [], nextOrderId: 1007 };
  const items = [{ id: 1, qty: 2 }];

  inventory.reserve(db.products, items);
  const order = orders.add(db, { items, status: 'pending' });
  assert.equal(product.stock, 3);
  assert.equal(inventory.getSellableStock(product), 1);

  assert.equal(orders.cancel(db, order.id).ok, true);
  assert.equal(order.status, 'cancelled');
  assert.equal(product.stock, 5);
  assert.equal(product.reserved, 2);
  assert.equal(inventory.getSellableStock(product), 3);

  assert.equal(orders.cancel(db, order.id).ok, false);
  assert.equal(product.stock, 5);
});
