const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');

test('sellable stock excludes reservations and never goes below zero', () => {
  assert.equal(inventory.getSellableStock({ stock: 10, reserved: 3 }), 7);
  assert.equal(inventory.getSellableStock({ stock: 2, reserved: 3 }), 0);
  assert.equal(inventory.getSellableStock({ stock: 4 }), 4);
  assert.equal(inventory.getSellableStock(null), 0);
});

test('stock checks accept quantities below availability without changing inventory', () => {
  const products = [{ id: 1, name: 'Rice', stock: 10, reserved: 3 }];
  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 6 }]), { ok: true });
  assert.deepEqual(products, [{ id: 1, name: 'Rice', stock: 10, reserved: 3 }]);
});

test('stock checks reject unknown products and quantities above availability', () => {
  const products = [{ id: 1, name: 'Rice', stock: 10, reserved: 3 }];
  assert.deepEqual(inventory.check(products, [{ id: 99, qty: 1 }]), {
    ok: false, msg: 'Unknown product 99'
  });
  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 8 }]), {
    ok: false, msg: 'Rice is out of stock (7 sellable available)'
  });
});

test('purchasing exactly the remaining sellable quantity is accepted', () => {
  for (const [stock, reserved, qty] of [[10, 3, 7], [1, 0, 1]]) {
    assert.deepEqual(inventory.check([{ id: 1, name: 'Rice', stock, reserved }], [{ id: 1, qty }]), {
      ok: true
    });
  }
});

test('reserve deducts physical stock while preserving wholesale reservations', () => {
  const products = [{ id: 1, stock: 10, reserved: 3 }, { id: 2, stock: 5, reserved: 1 }];
  inventory.reserve(products, [{ id: 1, qty: 2 }]);
  assert.deepEqual(products, [{ id: 1, stock: 8, reserved: 3 }, { id: 2, stock: 5, reserved: 1 }]);
  assert.equal(inventory.getSellableStock(products[0]), 5);
});

test('release with productId reduces held reservations and clamps them to zero', () => {
  const products = [{ id: 1, stock: 10, reserved: 3 }];
  inventory.release(products, [{ productId: 1, qty: 2 }]);
  assert.deepEqual(products, [{ id: 1, stock: 10, reserved: 1 }]);
  inventory.release(products, [{ productId: 1, qty: 2 }]);
  assert.deepEqual(products, [{ id: 1, stock: 10, reserved: 0 }]);
});
