var test = require('node:test');
var assert = require('node:assert/strict');
var store = require('../lib/store');
var app = require('../server');
var inventory = require('../lib/inventory');

function makeDb(stock) {
  return {
    nextOrderId: 1001,
    nextSettlementId: 501,
    products: [{
      id: 1,
      sku: 'TEST-001',
      name: 'Test product',
      category: 'Test',
      unit: 'unit',
      hsn: '1006',
      price: 10,
      stock: stock,
      reserved: 0,
      reorderLevel: 1
    }],
    customers: [],
    orders: [],
    settlements: [],
    auditLog: []
  };
}

test('order and cancellation endpoints use isolated inventory state', async function (t) {
  var originalRead = store.read;
  var originalWrite = store.write;
  var state = makeDb(10);
  store.read = function () { return state; };
  store.write = function (db) { state = db; };

  var server = app.listen(0);
  await new Promise(function (resolve) { server.once('listening', resolve); });
  var baseUrl = 'http://127.0.0.1:' + server.address().port;

  t.after(async function () {
    await new Promise(function (resolve, reject) {
      server.close(function (err) { if (err) reject(err); else resolve(); });
    });
    store.read = originalRead;
    store.write = originalWrite;
  });

  async function placeOrder(qty) {
    return fetch(baseUrl + '/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ id: 1, qty: qty }] })
    });
  }

  var exact = await placeOrder(10);
  assert.equal(exact.status, 201);
  var order = await exact.json();
  assert.equal(state.auditLog.length, 1);
  assert.equal(state.products[0].stock, 0);
  assert.equal(state.products[0].reserved, 0);
  assert.equal(inventory.getSellableStock(state.products[0]), 0);

  var cancel = await fetch(baseUrl + '/api/orders/' + order.id + '/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'endpoint regression test' })
  });
  assert.equal(cancel.status, 200);
  assert.equal(state.orders[0].status, 'cancelled');
  assert.equal(state.products[0].stock, 10);
  assert.equal(state.products[0].reserved, 0);
  assert.equal(state.auditLog.length, 2);

  var cancelAgain = await fetch(baseUrl + '/api/orders/' + order.id + '/cancel', { method: 'POST' });
  assert.equal(cancelAgain.status, 400);
  assert.equal(state.products[0].stock, 10);
  assert.equal(state.auditLog.length, 2);

  state = makeDb(10);
  var over = await placeOrder(11);
  assert.equal(over.status, 409);
  assert.equal(state.products[0].stock, 10);

  var invalidQuantities = [0, -1, 'not-a-number', 1.5];
  for (var i = 0; i < invalidQuantities.length; i++) {
    var qty = invalidQuantities[i];
    var invalid = await placeOrder(qty);
    assert.equal(invalid.status, 400, 'quantity ' + String(qty));
    assert.equal(state.products[0].stock, 10);
  }
});
