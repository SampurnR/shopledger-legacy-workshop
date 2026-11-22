'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

function product(stock, reserved) {
  return {
    id: 7,
    sku: 'SKU-007',
    name: 'Sample Rice',
    hsn: '1006',
    price: 100,
    stock: stock,
    reserved: reserved
  };
}

test('inventory.check allows qty 1 when sellable stock is 1', function () {
  const p = product(1, 0);
  assert.deepEqual(inventory.check([p], [{ id: p.id, qty: 1 }]), { ok: true });
});

test('CURRENT BEHAVIOUR: inventory.check rejects qty 2 when sellable stock is 1', function () {
  const p = product(1, 0);
  assert.deepEqual(inventory.check([p], [{ id: p.id, qty: 2 }]), {
    ok: false,
    msg: 'Sample Rice is out of stock (1 sellable available)'
  });
});

test('CURRENT BEHAVIOUR: inventory.check accepts qty 0 when sellable stock is 1', function () {
  const p = product(1, 0);
  assert.deepEqual(inventory.check([p], [{ id: p.id, qty: 0 }]), { ok: true });
});

test('stock 4 with reserved 3 leaves 1 sellable and allows qty 1', function () {
  const p = product(4, 3);
  assert.equal(inventory.getSellableStock(p), 1);
  assert.deepEqual(inventory.check([p], [{ id: p.id, qty: 1 }]), { ok: true });
});

test('cancelling a pending order returns stock after reserve deducted it', function () {
  const p = product(4, 3);
  const item = {
    id: p.id,
    sku: p.sku,
    name: p.name,
    hsn: p.hsn,
    price: p.price,
    qty: 1
  };
  const order = {
    id: 101,
    status: 'pending',
    paymentMode: 'cash',
    customerId: null,
    items: [item],
    total: 100
  };
  const db = { products: [p], orders: [order] };

  const before = { stock: p.stock, reserved: p.reserved };
  inventory.reserve(db.products, order.items);
  const afterReserve = { stock: p.stock, reserved: p.reserved };

  const result = orders.cancel(db, order.id, 'characterization test');
  const afterCancel = { stock: p.stock, reserved: p.reserved };

  assert.deepEqual(before, { stock: 4, reserved: 3 });
  assert.deepEqual(afterReserve, { stock: 3, reserved: 3 });
  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.deepEqual(afterCancel, { stock: 4, reserved: 3 });
});


test('allows exactly the remaining sellable stock and restores it on cancellation once', function () {
  const p = product(4, 3);
  const item = {
    id: p.id,
    sku: p.sku,
    name: p.name,
    hsn: p.hsn,
    price: p.price,
    qty: 1
  };
  const order = {
    id: 102,
    status: 'pending',
    paymentMode: 'cash',
    customerId: null,
    items: [item],
    total: 100
  };
  const db = { products: [p], orders: [order] };

  assert.deepEqual(inventory.check(db.products, order.items), { ok: true });
  assert.deepEqual(inventory.check(db.products, [item, Object.assign({}, item)]), {
    ok: false,
    msg: 'Sample Rice is out of stock (1 sellable available)'
  });
  inventory.reserve(db.products, order.items);
  assert.deepEqual({ stock: p.stock, reserved: p.reserved }, { stock: 3, reserved: 3 });

  const firstCancel = orders.cancel(db, order.id, 'correct behaviour test');
  assert.equal(firstCancel.ok, true);
  assert.deepEqual({ stock: p.stock, reserved: p.reserved }, { stock: 4, reserved: 3 });

  const secondCancel = orders.cancel(db, order.id, 'duplicate cancellation attempt');
  assert.equal(secondCancel.ok, false);
  assert.deepEqual({ stock: p.stock, reserved: p.reserved }, { stock: 4, reserved: 3 });
});
