const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');

test('allows an order for exactly all sellable stock', () => {
  const products = [{ id: 1, name: 'Rice', stock: 5, reserved: 1 }];
  const items = [{ id: 1, qty: 4 }];

  const result = inventory.check(products, items);

  assert.deepEqual(result, { ok: true });
});

test('CURRENT BEHAVIOUR: rejects quantities above sellable stock', () => {
  const products = [{ id: 1, name: 'Rice', stock: 5, reserved: 1 }];
  const items = [{ id: 1, qty: 5 }];

  const result = inventory.check(products, items);

  assert.equal(result.ok, false);
});
