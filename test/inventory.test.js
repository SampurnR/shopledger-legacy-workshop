const assert = require('node:assert/strict');
const test = require('node:test');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

function cancelPendingOrder() {
  const products = [
    { id: 1, stock: 3, reserved: 0 },
    { id: 2, stock: 6, reserved: 3 }
  ];
  const order = {
    id: 1007,
    status: 'pending',
    items: [{ id: 1, qty: 2 }, { id: 2, qty: 2 }]
  };
  const db = { products, orders: [order] };
  inventory.reserve(products, order.items);
  assert.deepEqual(products.map(p => p.stock), [1, 4]);
  assert.equal(orders.cancel(db, order.id).ok, true);
  assert.equal(order.status, 'cancelled');
  assert.equal(orders.cancel(db, order.id).ok, false);
  return products;
}

test('selling the exact sellable quantity preserves wholesale reservations', () => {
  const products = [
    { id: 1, sku: 'DRY-001', stock: 1, reserved: 0 },
    { id: 2, sku: 'SPC-001', stock: 4, reserved: 3 },
    { id: 3, stock: 8, reserved: 3 }
  ];
  const items = [{ id: 1, qty: 1 }, { id: 2, qty: 1 }, { id: 3, qty: 5 }];
  assert.equal(inventory.check(products, items).ok, true);
  inventory.reserve(products, items);
  assert.deepEqual(products.map(p => p.stock), [0, 3, 3]);
  assert.deepEqual(products.map(inventory.getSellableStock), [0, 0, 0]);
});

test('repeated order lines cannot consume reserved units', () => {
  const products = [{ id: 1, name: 'Chilli powder', stock: 7, reserved: 3 }];
  assert.equal(inventory.check(products, [{ id: 1, qty: 5 }]).ok, false);
  assert.equal(inventory.check(products, [{ id: 1, qty: 2 }, { id: '1', qty: 3 }]).ok, false);
  assert.equal(inventory.check(products, [{ id: 1, qty: 2 }, { id: '1', qty: 2 }]).ok, true);
});

test('cancelling a pending order restores physical and sellable stock exactly once', () => {
  const products = cancelPendingOrder();
  assert.deepEqual(products.map(p => p.stock), [3, 6]);
  assert.deepEqual(products.map(p => p.reserved), [0, 3]);
  assert.deepEqual(products.map(inventory.getSellableStock), [3, 3]);
});
