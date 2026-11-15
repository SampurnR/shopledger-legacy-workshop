const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');

// Hand-built fixtures only. No persistence module or database file is used.
function product(stock, reserved = 0) {
  return { id: 6, name: 'A2 Gir Cow Ghee 500ml', stock, reserved };
}

test('last sellable unit can be checked and sold without consuming reservation holds', () => {
  const products = [product(4, 3)];
  const items = [{ id: 6, qty: 1 }];
  assert.deepEqual(inventory.check(products, items), { ok: true });
  inventory.reserve(products, items);
  assert.deepEqual(products, [product(3, 3)]);
  assert.equal(inventory.getSellableStock(products[0]), 0);
});

test('release restores physical stock for every order item and leaves holds and unrelated products unchanged', () => {
  const products = [product(1), { id: 4, stock: 22, reserved: 4 }, { id: 9, stock: 15, reserved: 2 }];
  inventory.release(products, [{ id: 6, qty: 2 }, { id: 4, qty: 2 }]);
  assert.deepEqual(products, [product(3), { id: 4, stock: 24, reserved: 4 }, { id: 9, stock: 15, reserved: 2 }]);
});

test('sellable stock excludes reservations and never goes below zero', () => {
  assert.equal(inventory.getSellableStock(product(8, 3)), 5);
  assert.equal(inventory.getSellableStock(product(2, 3)), 0);
  assert.equal(inventory.getSellableStock({ stock: 3 }), 3);
  assert.equal(inventory.getSellableStock(null), 0);
});

for (const { stock, reserved, qty } of [
  { stock: 1, reserved: 0, qty: 1 },
  { stock: 8, reserved: 3, qty: 5 }
]) {
  test(`exact sellable quantity is accepted (stock=${stock}, reserved=${reserved}, qty=${qty})`, () => {
    const products = [product(stock, reserved)];
    const before = structuredClone(products);
    assert.deepEqual(inventory.check(products, [{ id: 6, qty }]), { ok: true });
    assert.deepEqual(products, before);
  });
}

test('quantity below sellable availability is accepted without changing stock', () => {
  const products = [product(8, 3)];
  assert.deepEqual(inventory.check(products, [{ id: 6, qty: 4 }]), { ok: true });
  assert.deepEqual(products, [product(8, 3)]);
});

test('quantity above availability and sales with no sellable stock are refused', () => {
  for (const [stock, reserved, qty, sellable] of [[8, 3, 6, 5], [0, 0, 1, 0], [3, 3, 1, 0]]) {
    assert.deepEqual(inventory.check([product(stock, reserved)], [{ id: 6, qty }]), {
      ok: false,
      msg: `A2 Gir Cow Ghee 500ml is out of stock (${sellable} sellable available)`
    });
  }
});

test('stock check rejects an unknown product', () => {
  assert.deepEqual(inventory.check([product(8)], [{ id: 999, qty: 1 }]), {
    ok: false, msg: 'Unknown product 999'
  });
});

test('reserve deducts physical stock for each order line and preserves reservation holds', () => {
  const products = [product(8, 3), { id: 4, stock: 10, reserved: 2 }];
  inventory.reserve(products, [{ id: 6, qty: 2 }, { id: 4, qty: 3 }]);
  assert.deepEqual(products, [product(6, 3), { id: 4, stock: 7, reserved: 2 }]);
});

test('reserve followed by release restores physical stock and preserves holds', () => {
  const products = [product(8, 3)];
  const items = [{ id: 6, qty: 2 }];
  inventory.reserve(products, items);
  inventory.release(products, items);
  assert.deepEqual(products, [product(8, 3)]);
});

test('release skips unrecognized productId-only lines without changing stock or holds', () => {
  const products = [product(6, 3)];
  inventory.release(products, [{ productId: 6, qty: 2 }]);
  assert.deepEqual(products, [product(6, 3)]);
});
