const assert = require('node:assert/strict');
const test = require('node:test');
const inventory = require('../lib/inventory');

function product(id, name, stock, reserved) {
  return { id, name, stock, reserved };
}

test('checkout can sell the final unit of DRY-001', () => {
  const ghee = product(6, 'A2 Gir Cow Ghee 500ml', 1, 0);
  const items = [{ id: 6, qty: 1 }];

  assert.deepEqual(inventory.check([ghee], items), { ok: true });
  inventory.reserve([ghee], items);

  assert.equal(ghee.stock, 0);
  assert.equal(ghee.reserved, 0);
  assert.equal(inventory.getSellableStock(ghee), 0);
});

test('checkout can sell the final unreserved unit of SPC-001', () => {
  const chilli = product(11, 'Byadgi Kashmiri Chilli Powder 500g', 4, 3);
  const items = [{ id: 11, qty: 1 }];

  assert.deepEqual(inventory.check([chilli], items), { ok: true });
  inventory.reserve([chilli], items);

  assert.equal(chilli.stock, 3);
  assert.equal(chilli.reserved, 3);
  assert.equal(inventory.getSellableStock(chilli), 0);
});

test('checkout rejects quantities above sellable stock and units held entirely for wholesale', () => {
  const products = [product(6, 'Ghee', 1, 0), product(11, 'Chilli', 4, 3), product(4, 'Oil', 4, 4)];

  assert.equal(inventory.check(products, [{ id: 6, qty: 2 }]).ok, false);
  assert.equal(inventory.check(products, [{ id: 11, qty: 2 }]).ok, false);
  assert.equal(inventory.check(products, [{ id: 4, qty: 1 }]).ok, false);
  assert.deepEqual(products.map(({ stock, reserved }) => [stock, reserved]), [[1, 0], [4, 3], [4, 4]]);
});

test('checkout counts all lines for the same product against its sellable stock', () => {
  const chilli = product(11, 'Chilli', 5, 3);
  const items = [{ id: 11, qty: 1 }, { id: '11', qty: 1 }];

  assert.equal(inventory.check([chilli], items).ok, true);
  assert.equal(inventory.check([chilli], [...items, { id: 11, qty: 1 }]).ok, false);
  assert.deepEqual([chilli.stock, chilli.reserved], [5, 3]);
});

test('checkout still rejects an unknown product', () => {
  assert.deepEqual(inventory.check([], [{ id: 99, qty: 1 }]), { ok: false, msg: 'Unknown product 99' });
});

test('releasing a wholesale hold reduces reserved stock without changing physical stock', () => {
  const chilli = product(11, 'Chilli', 4, 3);

  inventory.release([chilli], [{ productId: 11, qty: 2 }]);
  assert.deepEqual([chilli.stock, chilli.reserved], [4, 1]);
  inventory.release([chilli], [{ productId: 11, qty: 2 }]);
  assert.deepEqual([chilli.stock, chilli.reserved], [4, 0]);
});
