var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var fixtures = require('./helpers/fixtures');
var guard = require('./helpers/database-integrity').guard;

test('inventory boundaries allow exactly sellable stock and reject excess', function (t) {
  guard(t);

  var product = fixtures.product();
  assert.equal(inventory.getSellableStock(product), 3);
  assert.equal(inventory.getSellableStock(fixtures.product({ stock: 1, reserved: 2 })), 0);
  assert.equal(inventory.getSellableStock(null), 0);
  assert.equal(inventory.getSellableStock(fixtures.product({ stock: 1, reserved: undefined })), 1);

  assert.deepEqual(inventory.check([product], [{ id: 1, qty: 2 }]), { ok: true });
  assert.deepEqual(inventory.check([product], [{ id: 1, qty: 3 }]), { ok: true });
  assert.deepEqual(inventory.check([product], [{ id: 1, qty: 4 }]), {
    ok: false, msg: 'Rice is out of stock (3 sellable available)'
  });
  assert.deepEqual(product, fixtures.product(), 'checking stock does not mutate it');
});

test('the last sellable unit can be purchased with and without reservations', function (t) {
  guard(t);
  [fixtures.product({ stock: 1, reserved: 0 }), fixtures.product({ stock: 3, reserved: 2 })].forEach(function (product) {
    assert.deepEqual(inventory.check([product], [{ id: 1, qty: 1 }]), { ok: true });
  });
});

test('CURRENT BEHAVIOUR: empty items pass and unknown products fail', function (t) {
  guard(t);
  assert.deepEqual(inventory.check([], []), { ok: true });
  assert.deepEqual(inventory.check([], [{ id: 99, qty: 1 }]), { ok: false, msg: 'Unknown product 99' });
});

test('CURRENT BEHAVIOUR: duplicate lines are checked separately and can overdraw physical stock', function (t) {
  guard(t);
  var products = [fixtures.product({ stock: 3, reserved: 0 })];
  var items = [{ id: 1, qty: 2 }, { id: 1, qty: 2 }];
  // CHARACTERIZATION: current behaviour, possibly a bug — see AGENTS.md Known Quirks
  assert.deepEqual(inventory.check(products, items), { ok: true });
  inventory.reserve(products, items);
  assert.equal(products[0].stock, -1);
  assert.equal(products[0].reserved, 0);
});

test('release restores deducted physical stock without changing reservations', function (t) {
  guard(t);
  var products = [fixtures.product()];
  var items = [{ id: 1, qty: 2 }];
  inventory.reserve(products, items);
  assert.deepEqual(products[0], fixtures.product({ stock: 3 }));
  inventory.release(products, items);
  assert.deepEqual(products[0], fixtures.product());
});

test('release ignores unknown products and restores numeric quantities to numeric stock', function (t) {
  guard(t);
  var products = [fixtures.product({ stock: '3' })];
  inventory.release(products, [{ id: 1, qty: '2' }, { id: 99, qty: 1 }]);
  assert.deepEqual(products[0], fixtures.product());
});
