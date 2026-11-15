const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');

function product(overrides = {}) {
  return { id: 1, name: 'Fixture product', price: 100, stock: 10, reserved: 3,
    reorderLevel: 4, ...overrides };
}

test('find resolves numeric and string IDs to the original product', () => {
  const p = product();
  assert.equal(inventory.find([p], '1'), p);
  assert.equal(inventory.find([p], 99), null);
});

test('sellable stock subtracts wholesale holds without mutating the product', () => {
  const p = product();
  const before = { ...p };
  assert.equal(inventory.getSellableStock(p), 7);
  assert.deepEqual(p, before);
});

test('sellable stock defaults missing holds to zero and handles numeric strings', () => {
  assert.equal(inventory.getSellableStock({ stock: '4' }), 4);
  assert.equal(inventory.getSellableStock({ stock: '4', reserved: '3' }), 1);
});

test('sellable stock clamps exhausted and over-reserved products to zero', () => {
  assert.equal(inventory.getSellableStock(product({ stock: 0 })), 0);
  assert.equal(inventory.getSellableStock(product({ stock: 2, reserved: 3 })), 0);
  assert.equal(inventory.getSellableStock(null), 0);
});

test('stock check accepts a quantity below sellable stock without mutation', () => {
  const p = product();
  const before = { ...p };
  assert.deepEqual(inventory.check([p], [{ id: 1, qty: 6 }]), { ok: true });
  assert.deepEqual(p, before);
});

test('stock check rejects quantities above sellable stock', () => {
  assert.deepEqual(inventory.check([product()], [{ id: 1, qty: 8 }]), {
    ok: false, msg: 'Fixture product is out of stock (7 sellable available)'
  });
});

test('stock check rejects unknown products and accepts an empty cart', () => {
  assert.deepEqual(inventory.check([product()], [{ id: 99, qty: 1 }]), {
    ok: false, msg: 'Unknown product 99'
  });
  assert.deepEqual(inventory.check([product()], []), { ok: true });
});

test('stock check accepts the exact remaining sellable quantity', () => {
  const result = inventory.check([product()], [{ id: 1, qty: 7 }]);
  assert.deepEqual(result, { ok: true });
});

test('stock check accepts the last unreserved unit', () => {
  const result = inventory.check([product({ stock: 1, reserved: 0 })], [{ id: 1, qty: 1 }]);
  assert.equal(result.ok, true);
});

test('reserve deducts physical stock and preserves wholesale reserved holds', () => {
  const p = product();
  inventory.reserve([p], [{ id: '1', qty: 2 }]);
  assert.equal(p.stock, 8);
  assert.equal(p.reserved, 3);
  assert.equal(inventory.getSellableStock(p), 5);
});

test('reserve handles numeric quantity strings and ignores missing products', () => {
  const p = product();
  inventory.reserve([p], [{ id: 99, qty: 5 }, { id: 1, qty: '2' }]);
  assert.equal(p.stock, 8);
  assert.equal(p.reserved, 3);
});

test('release restores physical stock for order lines identified by id', () => {
  const p = product({ stock: 8 });
  inventory.release([p], [{ id: 1, qty: 2 }]);
  assert.equal(p.stock, 10);
  assert.equal(p.reserved, 3);
});

test('release skips unknown product IDs without changing known products', () => {
  const p = product();
  const before = { ...p };
  inventory.release([p], [{ id: 99, qty: 2 }]);
  assert.deepEqual(p, before);
});

test('summary counts out-of-stock and low-stock SKUs and values physical units', () => {
  const products = [product(), product({ id: 2, stock: 3, reserved: 0 }),
    product({ id: 3, stock: 2, reserved: 2 })];
  assert.deepEqual(inventory.summarize(products), {
    totalSkus: 3, outOfStockCount: 1, lowStockCount: 1, totalValuation: 1500
  });
});

test('summary of an empty inventory is zero', () => {
  assert.deepEqual(inventory.summarize([]), {
    totalSkus: 0, outOfStockCount: 0, lowStockCount: 0, totalValuation: 0
  });
});
