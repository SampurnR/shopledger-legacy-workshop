'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');

describe('lib/inventory', () => {
  it('allows selling the exact remaining sellable stock', () => {
    const products = [
      { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 },
      { id: 11, sku: 'SPC-001', name: 'Byadgi Kashmiri Chilli Powder 500g', stock: 4, reserved: 3 }
    ];

    const res1 = inventory.check(products, [{ id: 6, qty: 1 }]);
    assert.deepEqual(res1, { ok: true });

    const res2 = inventory.check(products, [{ id: 11, qty: 1 }]);
    assert.deepEqual(res2, { ok: true });

    const over = inventory.check(products, [{ id: 11, qty: 2 }]);
    assert.equal(over.ok, false);
    assert.match(over.msg, /1 sellable available/);
  });

  it('restores physical stock when an order is cancelled/released', () => {
    const products = [
      { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', stock: 18, reserved: 2 }
    ];

    inventory.reserve(products, [{ id: 1, qty: 3 }]);
    assert.equal(products[0].stock, 15);
    assert.equal(products[0].reserved, 2);

    inventory.release(products, [{ id: 1, qty: 3 }]);
    assert.equal(products[0].stock, 18);
    assert.equal(products[0].reserved, 2);
  });
});
