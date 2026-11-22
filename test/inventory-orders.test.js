'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

test('stock check allows an order for all remaining sellable units and rejects excess', function () {
  const products = [
    { id: 1, name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 },
    { id: 2, name: 'Byadgi Chilli Powder', stock: 4, reserved: 3 }
  ];

  assert.equal(inventory.getSellableStock(products[0]), 1);
  assert.equal(inventory.check(products, [{ id: 1, qty: 1 }]).ok, true);
  inventory.reserve(products, [{ id: 1, qty: 1 }]);
  assert.equal(products[0].stock, 0);
  assert.equal(inventory.getSellableStock(products[0]), 0);
  assert.equal(inventory.getSellableStock(products[1]), 1);
  assert.equal(inventory.check(products, [{ id: 2, qty: 1 }]).ok, true);
  assert.equal(inventory.check(products, [{ id: 2, qty: 2 }]).ok, false);
});

test('cancelling a pending order restores physical stock exactly once', function () {
  const db = {
    products: [{ id: 7, name: 'Ghee', stock: 0, reserved: 0 }],
    orders: [{
      id: 1007,
      status: 'pending',
      paymentMode: 'cash',
      total: 450,
      items: [{ id: 7, name: 'Ghee', qty: 1 }]
    }]
  };

  const result = orders.cancel(db, 1007, 'Customer cancelled');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(db.products[0].stock, 1);
  assert.equal(db.products[0].reserved, 0);

  const repeated = orders.cancel(db, 1007, 'Duplicate cancellation');
  assert.equal(repeated.ok, false);
  assert.equal(db.products[0].stock, 1);
});
