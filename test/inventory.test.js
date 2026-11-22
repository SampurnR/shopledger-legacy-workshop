const test = require('node:test');
const assert = require('node:assert/strict');

const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

test('allows selling exactly the remaining sellable quantity', () => {
  const products = [
    { id: 6, name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 },
    { id: 11, name: 'Byadgi Kashmiri Chilli Powder 500g', stock: 4, reserved: 3 }
  ];

  assert.deepEqual(inventory.check(products, [{ id: 6, qty: 1 }]), { ok: true });
  assert.deepEqual(inventory.check(products, [{ id: 11, qty: 1 }]), { ok: true });
});

test('cancelling an order restores deducted physical stock exactly once', () => {
  const db = {
    products: [
      { id: 6, name: 'A2 Gir Cow Ghee 500ml', stock: 3, reserved: 0 },
      { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', stock: 10, reserved: 2 }
    ],
    orders: [{
      id: 1007,
      customer: 'Suresh Deshmukh',
      paymentMode: 'cash',
      status: 'pending',
      items: [{ id: 6, qty: 2 }, { id: 4, qty: 2 }],
      total: 1407
    }]
  };
  const items = db.orders[0].items;

  inventory.reserve(db.products, items);
  assert.deepEqual(db.products.map(product => product.stock), [1, 8]);

  const result = orders.cancel(db, 1007, 'Test cancellation');
  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.deepEqual(db.products.map(product => product.stock), [3, 10]);
  assert.deepEqual(db.products.map(product => product.reserved), [0, 2]);

  assert.equal(orders.cancel(db, 1007).ok, false);
  assert.deepEqual(db.products.map(product => product.stock), [3, 10]);
});
