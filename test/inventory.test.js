'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

test('EXPECTED BEHAVIOUR: selling the last sellable unit is allowed', function () {
  const products = [{ id: 1, name: 'A2 Ghee', stock: 4, reserved: 3 }];

  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 1 }]), { ok: true });
});

test('EXPECTED BEHAVIOUR: cancelling a pending order restores its physical stock', function () {
  const product = { id: 1, name: 'A2 Ghee', stock: 3, reserved: 3 };
  const db = {
    products: [product],
    orders: [{
      id: 1007,
      status: 'pending',
      paymentMode: 'cash',
      items: [{ id: 1, qty: 1 }]
    }]
  };

  const result = orders.cancel(db, 1007, 'Test cancellation');

  assert.equal(result.ok, true);
  assert.equal(product.stock, 4);
  assert.equal(product.reserved, 3);
  assert.equal(inventory.getSellableStock(product), 1);
});
