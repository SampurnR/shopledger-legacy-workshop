'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

test('sellable quantities and cancellation preserve stock exactly once', async (t) => {
  await t.test('allows exactly the remaining sellable quantity but never more', () => {
    const products = [{ id: 1, name: 'Rice', stock: 3, reserved: 1 }];

    assert.deepEqual(inventory.check(products, [{ id: 1, qty: 2 }]), { ok: true });
    assert.equal(inventory.check(products, [{ id: 1, qty: 3 }]).ok, false);
  });

  await t.test('restores cancelled item stock once', () => {
    const products = [{ id: 1, name: 'Rice', stock: 3, reserved: 0 }];
    const items = [{ id: 1, name: 'Rice', qty: 1 }];
    inventory.reserve(products, items);

    const db = {
      products,
      customers: [],
      orders: [{
        id: 1001,
        status: 'completed',
        paymentMode: 'cash',
        items
      }]
    };

    assert.equal(products[0].stock, 2);
    assert.equal(orders.cancel(db, 1001, 'test cancellation').ok, true);
    assert.equal(products[0].stock, 3);
    assert.equal(orders.cancel(db, 1001, 'duplicate cancellation').ok, false);
    assert.equal(products[0].stock, 3);
  });
});
