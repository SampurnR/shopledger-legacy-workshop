const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

test('accepts qty 1 when 1 unit is sellable', () => {
  const product = { id: 1, name: 'Rice', stock: 1, reserved: 0 };

  assert.deepEqual(inventory.check([product], [{ id: 1, qty: 1 }]), { ok: true });
});

test('CURRENT BEHAVIOUR: rejects qty 2 when 1 unit is sellable', () => {
  const product = { id: 1, name: 'Rice', stock: 1, reserved: 0 };

  assert.deepEqual(inventory.check([product], [{ id: 1, qty: 2 }]), {
    ok: false,
    msg: 'Rice is out of stock (1 sellable available)'
  });
});

test('CURRENT BEHAVIOUR: accepts qty 0 when 1 unit is sellable', () => {
  const product = { id: 1, name: 'Rice', stock: 1, reserved: 0 };

  assert.deepEqual(inventory.check([product], [{ id: 1, qty: 0 }]), { ok: true });
});

test('stock 4 with 3 reserved leaves 1 sellable and accepts qty 1', () => {
  const product = { id: 1, name: 'Rice', stock: 4, reserved: 3 };

  assert.equal(inventory.getSellableStock(product), 1);
  assert.deepEqual(inventory.check([product], [{ id: 1, qty: 1 }]), { ok: true });
});

test('cancelling a pending order restores physical stock and keeps reservations', () => {
  const product = {
    id: 1,
    sku: 'RICE-1',
    name: 'Rice',
    hsn: '1006',
    price: 100,
    stock: 5,
    reserved: 2
  };
  const items = [{
    id: product.id,
    sku: product.sku,
    name: product.name,
    hsn: product.hsn,
    price: product.price,
    qty: 2
  }];
  const db = { products: [product], orders: [] };

  const beforeOrder = { stock: product.stock, reserved: product.reserved };
  inventory.reserve(db.products, items);
  const afterReserve = { stock: product.stock, reserved: product.reserved };

  const order = { id: 1001, status: 'pending', paymentMode: 'cash', items };
  db.orders.push(order);
  const result = orders.cancel(db, order.id, 'Customer cancelled');
  const afterCancel = { stock: product.stock, reserved: product.reserved };

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.deepEqual({ beforeOrder, afterReserve, afterCancel }, {
    beforeOrder: { stock: 5, reserved: 2 },
    afterReserve: { stock: 3, reserved: 2 },
    afterCancel: { stock: 5, reserved: 2 }
  });
});

test('buys all sellable units across lines and restores them exactly once', () => {
  const product = {
    id: 1,
    sku: 'RICE-1',
    name: 'Rice',
    hsn: '1006',
    price: 100,
    stock: 5,
    reserved: 2
  };
  const line = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    hsn: product.hsn,
    price: product.price,
    qty: 2
  };
  const items = [line, { ...line, qty: 1 }];
  const order = { id: 1001, status: 'pending', paymentMode: 'cash', items };
  const db = { products: [product], orders: [order] };

  const tooMany = inventory.check(db.products, [line, { ...line }]);
  const exact = inventory.check(db.products, items);
  inventory.reserve(db.products, items);
  const afterReserve = { stock: product.stock, reserved: product.reserved };

  const firstCancel = orders.cancel(db, order.id);
  const afterCancel = { stock: product.stock, reserved: product.reserved };
  const secondCancel = orders.cancel(db, order.id);
  const afterSecondCancel = { stock: product.stock, reserved: product.reserved };

  assert.deepEqual({
    tooMany: tooMany.ok,
    exact: exact.ok,
    afterReserve,
    firstCancel: firstCancel.ok,
    afterCancel,
    secondCancel: secondCancel.ok,
    afterSecondCancel
  }, {
    tooMany: false,
    exact: true,
    afterReserve: { stock: 2, reserved: 2 },
    firstCancel: true,
    afterCancel: { stock: 5, reserved: 2 },
    secondCancel: false,
    afterSecondCancel: { stock: 5, reserved: 2 }
  });
});
