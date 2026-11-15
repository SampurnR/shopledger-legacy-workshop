'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

function makeDb() {
  return {
    nextOrderId: 1008,
    products: [
      { id: 1, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 },
      { id: 2, sku: 'SPC-001', name: 'Byadgi Chilli Powder', stock: 4, reserved: 3 }
    ],
    orders: []
  };
}

test('allows selling the one remaining sellable ghee unit', () => {
  const db = makeDb();

  assert.equal(inventory.getSellableStock(db.products[0]), 1);
  assert.deepEqual(inventory.check(db.products, [{ id: 1, qty: 1 }]), { ok: true });
});

test('allows selling the one remaining sellable chilli packet while preserving the reserved units', () => {
  const db = makeDb();

  assert.equal(inventory.getSellableStock(db.products[1]), 1);
  assert.deepEqual(inventory.check(db.products, [{ id: 2, qty: 1 }]), { ok: true });
  inventory.reserve(db.products, [{ id: 2, qty: 1 }]);
  assert.equal(db.products[1].stock, 3);
  assert.equal(db.products[1].reserved, 3);
  assert.equal(inventory.getSellableStock(db.products[1]), 0);
});

test('allows quantity equal to sellable stock and rejects quantity above it', () => {
  const products = [{ id: 7, name: 'Bulk item', stock: 12, reserved: 5 }];

  assert.deepEqual(inventory.check(products, [{ id: 7, qty: 7 }]), { ok: true });
  assert.deepEqual(inventory.check(products, [{ id: 7, qty: 8 }]), {
    ok: false,
    msg: 'Bulk item is out of stock (7 sellable available)'
  });
});

test('rejects duplicate order lines whose combined quantity exceeds sellable stock', () => {
  const products = [{ id: 8, name: 'Single item', stock: 1, reserved: 0 }];

  assert.deepEqual(inventory.check(products, [
    { id: 8, qty: 1 },
    { id: 8, qty: 1 }
  ]), {
    ok: false,
    msg: 'Single item is out of stock (1 sellable available)'
  });
});

test('cancelling Pending Order #1007 restores its item quantities to stock', () => {
  const db = {
    products: [
      { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 },
      { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', stock: 22, reserved: 4 }
    ],
    orders: []
  };
  db.orders.push({
    id: 1007,
    status: 'pending',
    paymentMode: 'cash',
    items: [
      { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', qty: 2 },
      { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', qty: 2 }
    ]
  });

  const result = orders.cancel(db, 1007, 'Cancelled from order history');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(db.products[0].stock, 3);
  assert.equal(db.products[0].reserved, 0);
  assert.equal(db.products[1].stock, 24);
  assert.equal(db.products[1].reserved, 4);
});

test('inventory release restores stock using the order line id without altering wholesale reservations', () => {
  const products = [{ id: 1, name: 'Item', stock: 8, reserved: 3 }];

  inventory.release(products, [{ id: 1, qty: 2 }]);
  assert.equal(products[0].stock, 10);
  assert.equal(products[0].reserved, 3);
});
