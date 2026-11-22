var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

function product(id, stock, reserved) {
  return { id: id, name: 'Product ' + id, stock: stock, reserved: reserved || 0, price: 10 };
}

function fixture(products, items) {
  var db = { products: products, orders: [], nextOrderId: 1, customers: [] };
  var lines = items.map(function (item) {
    return { id: item.id, qty: item.qty, price: 10, name: 'Product ' + item.id };
  });
  var check = inventory.check(db.products, lines);
  assert.equal(check.ok, true, check.msg);
  inventory.reserve(db.products, lines);
  var order = orders.add(db, { items: lines, total: 10, status: 'pending' });
  return { db: db, order: order };
}

test('accepts order quantity equal to sellable stock and rejects over-stock without mutation', function () {
  var exact = product(1, 10, 0);
  assert.deepEqual(inventory.check([exact], [{ id: 1, qty: 10 }]), { ok: true });

  var over = product(1, 10, 0);
  var result = inventory.check([over], [{ id: 1, qty: 11 }]);
  assert.equal(result.ok, false);
  assert.equal(over.stock, 10);
  assert.equal(over.reserved, 0);
});

test('sellable stock excludes quote reservations and allows exactly the remaining units', function () {
  var p = product(1, 12, 2);
  assert.equal(inventory.getSellableStock(p), 10);
  assert.equal(inventory.check([p], [{ id: 1, qty: 11 }]).ok, false);
  assert.equal(inventory.check([p], [{ id: 1, qty: 10 }]).ok, true);
});

test('rejects invalid, non-positive, unsafe, and fractional order quantities', function (t) {
  [0, -1, '', '   ', 'nope', '1x', '0x10', '1e2', true, null, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].forEach(function (qty) {
    assert.equal(inventory.parseQuantity(qty), null, 'invalid quantity ' + String(qty));
    assert.equal(inventory.check([product(1, 10, 0)], [{ id: 1, qty: qty }]).ok, false);
  });
  assert.equal(inventory.parseQuantity('2'), 2);
  assert.equal(inventory.parseQuantity(2), 2);
});

test('checks combined quantities when a product appears on multiple lines', function () {
  var p = product(1, 10, 0);
  assert.equal(inventory.check([p], [{ id: 1, qty: 6 }, { id: 1, qty: 4 }]).ok, true);
  assert.equal(inventory.check([p], [{ id: 1, qty: 6 }, { id: 1, qty: 5 }]).ok, false);
  assert.equal(p.stock, 10);
});

test('reservation and cancellation restore physical stock while preserving reserved quote units', function () {
  var p = product(1, 11, 1);
  var state = fixture([p], [{ id: 1, qty: 10 }]);
  assert.equal(p.stock, 1);
  assert.equal(p.reserved, 1);
  assert.equal(inventory.getSellableStock(p), 0);

  var result = orders.cancel(state.db, state.order.id, 'test cancellation');
  assert.equal(result.ok, true);
  assert.equal(p.stock, 11);
  assert.equal(p.reserved, 1);
  assert.equal(inventory.getSellableStock(p), 10);
  assert.equal(state.order.status, 'cancelled');
});

test('cancellation restores every product in a multi-line order', function () {
  var first = product(1, 5, 1);
  var second = product(2, 8, 3);
  var state = fixture([first, second], [{ id: 1, qty: 2 }, { id: 2, qty: 4 }]);
  assert.deepEqual([first.stock, second.stock], [3, 4]);

  assert.equal(orders.cancel(state.db, state.order.id).ok, true);
  assert.deepEqual([first.stock, second.stock], [5, 8]);
  assert.deepEqual([first.reserved, second.reserved], [1, 3]);
});

test('repeated cancellation is rejected without restoring stock twice', function () {
  var p = product(1, 5, 0);
  var state = fixture([p], [{ id: 1, qty: 2 }]);
  assert.equal(orders.cancel(state.db, state.order.id).ok, true);
  var restoredStock = p.stock;

  var second = orders.cancel(state.db, state.order.id);
  assert.equal(second.ok, false);
  assert.match(second.error, /already cancelled/);
  assert.equal(p.stock, restoredStock);
  assert.equal(state.order.status, 'cancelled');
});

test('missing or invalid line during release fails without partial stock mutation', function () {
  var first = product(1, 5, 0);
  var second = product(2, 8, 0);
  var missing = inventory.release([first, second], [
    { id: 1, qty: 2 }, { id: 99, qty: 1 }
  ]);
  assert.equal(missing.ok, false);
  assert.deepEqual([first.stock, second.stock], [5, 8]);

  var invalid = inventory.release([first, second], [
    { id: 1, qty: 2 }, { id: 2, qty: 'invalid' }
  ]);
  assert.equal(invalid.ok, false);
  assert.deepEqual([first.stock, second.stock], [5, 8]);

  second.stock = 'corrupt';
  var corruptStock = inventory.release([first, second], [
    { id: 1, qty: 2 }, { id: 2, qty: 1 }
  ]);
  assert.equal(corruptStock.ok, false);
  assert.equal(first.stock, 5);
  assert.equal(second.stock, 'corrupt');
});

test('failed cancellation leaves order status unchanged when restoration cannot complete', function () {
  var p = product(1, 5, 0);
  var db = { products: [p], orders: [], nextOrderId: 1, customers: [] };
  var order = orders.add(db, { items: [{ id: 1, qty: 2 }, { id: 99, qty: 1 }], total: 10 });
  var result = orders.cancel(db, order.id);

  assert.equal(result.ok, false);
  assert.equal(order.status, 'completed');
  assert.equal(p.stock, 5);
});
