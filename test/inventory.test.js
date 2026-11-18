const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');

test('allows buying the exact remaining sellable quantity', () => {
  const products = [{ id: 'DRY-001', stock: 1, reserved: 0 }];

  const result = inventory.check(products, [
    { id: 'DRY-001', qty: 1 }
  ]);

  assert.equal(result.ok, true);
});

test('rejects quantities greater than sellable stock', () => {
  const products = [{ id: 'DRY-001', stock: 1, reserved: 0 }];

  const result = inventory.check(products, [
    { id: 'DRY-001', qty: 2 }
  ]);

  assert.equal(result.ok, false);
});

test('release restores physical stock', () => {
  const products = [{ id: 'DRY-001', stock: 0, reserved: 0 }];

  inventory.release(products, [
    { id: 'DRY-001', qty: 1 }
  ]);

  assert.equal(products[0].stock, 1);
});