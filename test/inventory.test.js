const assert = require('node:assert/strict');
const { test } = require('node:test');
const inventory = require('../lib/inventory');

test('accepts the last unreserved unit', () => {
  const product = { id: 6, name: 'Ghee', stock: 1, reserved: 0 };

  assert.equal(inventory.getSellableStock(product), 1);
  assert.deepEqual(inventory.check([product], [{ id: 6, qty: 1 }]), { ok: true });
});

test('accepts the exact sellable quantity with a wholesale hold', () => {
  const product = { id: 11, name: 'Chilli powder', stock: 4, reserved: 3 };

  assert.equal(inventory.getSellableStock(product), 1);
  assert.deepEqual(inventory.check([product], [{ id: 11, qty: 1 }]), { ok: true });
});

test('rejects a quantity that would consume wholesale-held units', () => {
  const product = { id: 11, name: 'Chilli powder', stock: 4, reserved: 3 };

  assert.equal(inventory.check([product], [{ id: 11, qty: 2 }]).ok, false);
  assert.equal(product.stock, 4);
  assert.equal(product.reserved, 3);
});

test('deducts physical stock for an accepted sale while preserving the hold', () => {
  const product = { id: 11, name: 'Chilli powder', stock: 5, reserved: 3 };
  const items = [{ id: 11, qty: 1 }];

  assert.deepEqual(inventory.check([product], items), { ok: true });
  inventory.reserve([product], items);

  assert.equal(product.stock, 4);
  assert.equal(product.reserved, 3);
  assert.equal(inventory.getSellableStock(product), 1);
});
