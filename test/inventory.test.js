var test = require('node:test');
var assert = require('node:assert/strict');
var once = require('node:events').once;
var inventory = require('../lib/inventory');
var app = require('../server');
var store = require('../lib/store');

test('the last unit can be sold with or without wholesale reservations', function () {
  [{ stock: 1, reserved: 0 }, { stock: 4, reserved: 3 }].forEach(function (stock) {
    var products = [Object.assign({ id: 1, name: 'Item' }, stock)];
    var items = [{ id: 1, qty: 1 }];
    assert.equal(inventory.check(products, items).ok, true);
    inventory.reserve(products, items);
    assert.equal(inventory.getSellableStock(products[0]), 0);
    assert.equal(products[0].reserved, stock.reserved);
  });
});

test('stock checks allow the exact remainder and reject excess or unavailable stock', function () {
  var products = [{ id: 1, name: 'Item', stock: 7, reserved: 3 }];
  assert.equal(inventory.check(products, [{ id: 1, qty: 4 }]).ok, true);
  assert.equal(inventory.check(products, [{ id: 1, qty: 5 }]).ok, false);
  assert.equal(inventory.check(products, [{ id: 2, qty: 1 }]).ok, false);
  assert.equal(inventory.check([{ id: 1, stock: 3, reserved: 3 }], [{ id: 1, qty: 1 }]).ok, false);
  assert.equal(products[0].stock, 7);
});

test('duplicate cart lines share the available quantity, including string IDs', function () {
  var products = [{ id: 1, stock: 4, reserved: 1 }];
  assert.equal(inventory.check(products, [{ id: 1, qty: 1 }, { id: '1', qty: 2 }]).ok, true);
  assert.equal(inventory.check(products, [{ id: 1, qty: 2 }, { id: '1', qty: 2 }]).ok, false);
});

test('wholesale quote release still changes reservations without changing physical stock', function () {
  var products = [{ id: 1, stock: 4, reserved: 3 }];
  inventory.release(products, [{ productId: 1, qty: 2 }]);
  assert.deepEqual(products[0], { id: 1, stock: 4, reserved: 1 });
});

['pending', 'completed'].forEach(function (status) {
  test('cancelling a ' + status + ' sale restores stock and khata exactly once', async function (t) {
    var db = {
      products: [
        { id: 1, name: 'Ghee', price: 100, stock: 1, reserved: 0 },
        { id: 2, name: 'Chilli', price: 50, stock: 4, reserved: 3 }
      ],
      customers: [{ id: 1, name: 'Customer', creditLimit: 1000, openingBalance: 100,
        totalBilled: 0, totalSettled: 20, balance: 80 }],
      orders: [], auditLog: [], nextOrderId: 1001
    };
    var before = structuredClone(db);
    t.mock.method(store, 'read', function () { return structuredClone(db); });
    t.mock.method(store, 'write', function (updated) { db = structuredClone(updated); });
    var server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(function () { return new Promise(function (resolve) { server.close(resolve); }); });
    async function post(path, body, expectedStatus) {
      var response = await fetch('http://127.0.0.1:' + server.address().port + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      assert.equal(response.status, expectedStatus);
      return response.json();
    }
    var sale = { items: [{ id: 1, qty: 1 }, { id: 2, qty: 1 }],
      status: status, paymentMode: 'khata', customerId: 1 };
    var order = await post('/api/orders', sale, 201);
    assert.equal(db.customers[0].balance, 80 + order.total);
    assert.deepEqual(db.products.map(function (p) { return [p.stock, p.reserved, inventory.getSellableStock(p)]; }),
      [[0, 0, 0], [3, 3, 0]]);
    var afterSale = structuredClone(db);
    await post('/api/orders', sale, 409);
    assert.deepEqual(db, afterSale);
    var cancelled = await post('/api/orders/' + order.id + '/cancel', { reason: 'Returned' }, 200);
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.cancelReason, 'Returned');
    assert.deepEqual(db.products, before.products);
    assert.deepEqual(db.customers, before.customers);
    var afterCancel = structuredClone(db);
    await post('/api/orders/' + order.id + '/cancel', {}, 400);
    await post('/api/orders/9999/cancel', {}, 400);
    assert.deepEqual(db, afterCancel);
  });
});
