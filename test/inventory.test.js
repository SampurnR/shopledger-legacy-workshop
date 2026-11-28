const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

test('checkout allows the last sellable unit and protects reserved stock', () => {
  const products = [{ id: 1, name: 'Chilli', stock: 4, reserved: 3 }];
  assert.equal(inventory.check(products, [{ id: 1, qty: 1 }]).ok, true);
  assert.equal(inventory.check(products, [{ id: 1, qty: 2 }]).ok, false);
  assert.equal(inventory.check(products, [{ id: 1, qty: 1 }, { id: '1', qty: 1 }]).ok, false);
});

test('cancelling an order restores physical stock once and preserves reservations', () => {
  const product = { id: 1, stock: 5, reserved: 3 };
  const items = [{ id: 1, qty: 2 }];
  const db = { products: [product], orders: [{ id: 10, status: 'pending', items }] };
  inventory.reserve(db.products, items);

  assert.equal(orders.cancel(db, 10).ok, true);
  assert.equal(product.stock, 5);
  assert.equal(product.reserved, 3);
  assert.equal(orders.cancel(db, 10).ok, false);
  assert.equal(product.stock, 5);
});
