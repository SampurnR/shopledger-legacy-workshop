const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');

test('allows an order for exactly all sellable stock', () => {
  const products = [{ id: 1, name: 'Rice', stock: 5, reserved: 1 }];
  const items = [{ id: 1, qty: 4 }];

  const result = inventory.check(products, items);

  assert.deepEqual(result, { ok: true });
});

test('allows selling the last unreserved unit', () => {
  const products = [{ id: 6, name: 'A2 Gir Cow Ghee', stock: 1, reserved: 0 }];

  const result = inventory.check(products, [{ id: 6, qty: 1 }]);

  assert.deepEqual(result, { ok: true });
});

test('CURRENT BEHAVIOUR: rejects quantities above sellable stock', () => {
  const products = [{ id: 1, name: 'Rice', stock: 5, reserved: 1 }];
  const items = [{ id: 1, qty: 5 }];

  const result = inventory.check(products, items);

  assert.equal(result.ok, false);
});
