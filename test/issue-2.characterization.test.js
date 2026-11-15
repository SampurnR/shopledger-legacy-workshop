var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');
var dates = require('../lib/dates');

// All fixtures are in memory; never read or write data/db.json.
function products() {
  return [
    { id: 1, name: 'Ghee', stock: 1, reserved: 0 },
    { id: 2, name: 'Chilli', stock: 4, reserved: 3 },
    { id: 3, name: 'Oil', stock: 10, reserved: 2 }
  ];
}

function fixture(status) {
  return {
    products: products(),
    customers: [{ id: 1, openingBalance: 10, totalBilled: 150, totalSettled: 20, balance: 140 }],
    orders: [{ id: 1007, status: status || 'pending', paymentMode: 'khata', customerId: 1,
      total: 100, items: [{ id: 1, qty: 2 }, { id: 3, qty: 2 }] }]
  };
}

function cancel(db, id, reason) {
  var originalToday = dates.today;
  dates.today = function () { return '15/11/2026'; };
  try {
    return orders.cancel(db, id, reason);
  } finally {
    dates.today = originalToday;
  }
}

test('sellable stock excludes reservations and clamps at zero', function () {
  assert.equal(inventory.getSellableStock(products()[1]), 1);
  assert.equal(inventory.getSellableStock({ stock: 2, reserved: 3 }), 0);
  assert.equal(inventory.getSellableStock(null), 0);
});

test('REGRESSION: exact remaining sellable quantity is accepted without mutation', function () {
  var catalog = products();
  var before = JSON.stringify(catalog);
  catalog.forEach(function (p) {
    assert.deepEqual(inventory.check(catalog, [{ id: p.id, qty: inventory.getSellableStock(p) }]), {
      ok: true
    });
  });
  assert.equal(JSON.stringify(catalog), before);
});

test('below-availability succeeds; excess, zero availability and unknown products reject', function () {
  var catalog = products();
  assert.deepEqual(inventory.check(catalog, [{ id: 3, qty: 7 }]), { ok: true });
  assert.deepEqual(inventory.check(catalog, [{ id: 2, qty: 2 }]), {
    ok: false, msg: 'Chilli is out of stock (1 sellable available)'
  });
  assert.equal(inventory.check([{ id: 1, stock: 3, reserved: 3 }], [{ id: 1, qty: 1 }]).ok, false);
  assert.deepEqual(inventory.check(catalog, [{ id: 99, qty: 1 }]), { ok: false, msg: 'Unknown product 99' });
});

test('reserve deducts physical stock and preserves wholesale reservations', function () {
  var catalog = products();
  inventory.reserve(catalog, [{ id: 3, qty: '2' }]);
  assert.deepEqual(catalog[2], { id: 3, name: 'Oil', stock: 8, reserved: 2 });
});

test('REGRESSION: cancellation restores physical stock and reverses khata once', function () {
  ['pending', 'completed'].forEach(function (status) {
    var db = fixture(status);
    var result = cancel(db, '1007', 'Customer request');
    assert.equal(result.ok, true);
    assert.equal(result.order, db.orders[0]);
    assert.equal(result.order.status, 'cancelled');
    assert.equal(result.order.cancelledAt, '15/11/2026');
    assert.equal(result.order.cancelReason, 'Customer request');
    assert.deepEqual(db.products, [
      { id: 1, name: 'Ghee', stock: 3, reserved: 0 },
      { id: 2, name: 'Chilli', stock: 4, reserved: 3 },
      { id: 3, name: 'Oil', stock: 12, reserved: 2 }
    ]);
    assert.equal(db.customers[0].totalBilled, 50);
    assert.equal(db.customers[0].balance, 40);
    var after = JSON.stringify(db);
    assert.deepEqual(cancel(db, 1007), { ok: false, error: 'Order #1007 is already cancelled' });
    assert.equal(JSON.stringify(db), after);
  });
});

test('missing order rejects without mutation', function () {
  var db = fixture();
  var before = JSON.stringify(db);
  assert.deepEqual(cancel(db, 999), { ok: false, error: 'Order not found' });
  assert.equal(JSON.stringify(db), before);
});


test('REGRESSION: exact-stock sale and cancellation restore the original inventory', function () {
  var db = fixture();
  var before = JSON.stringify(db.products);
  var items = [{ id: 1, qty: 1 }, { id: 2, qty: 1 }, { id: 3, qty: 8 }];
  assert.deepEqual(inventory.check(db.products, items), { ok: true });
  inventory.reserve(db.products, items);
  db.products.forEach(function (p) { assert.equal(inventory.getSellableStock(p), 0); });
  db.orders[0].items = items;
  assert.equal(cancel(db, 1007).ok, true);
  assert.equal(JSON.stringify(db.products), before);
});

test('order routes persist exact-stock sales and restore stock only on the first cancellation', function () {
  var store = require('../lib/store');
  var router = require('../routes/orders');
  var originalRead = store.read;
  var originalWrite = store.write;
  var originalToday = dates.today;
  var db = { products: products(), orders: [], customers: [], auditLog: [], nextOrderId: 1007 };
  var before = JSON.stringify(db.products);
  var writes = 0;

  function post(path, body, params) {
    var layer = router.stack.find(function (entry) {
      return entry.route && entry.route.path === path && entry.route.methods.post;
    });
    var response = { statusCode: 200 };
    response.status = function (code) { this.statusCode = code; return this; };
    response.json = function (value) { this.body = value; return this; };
    layer.route.stack[0].handle({ body: body, params: params || {} }, response);
    return response;
  }

  // Replace both storage operations before invoking any route. Clone reads/writes
  // to exercise persistence boundaries without accessing the real database.
  store.read = function () { return JSON.parse(JSON.stringify(db)); };
  store.write = function (value) { db = JSON.parse(JSON.stringify(value)); writes++; };
  dates.today = function () { return '15/11/2026'; };
  try {
    ['pending', 'completed'].forEach(function (status) {
      var created = post('/orders', { status: status, items: [{ id: 1, qty: 1 }, { id: 2, qty: 1 }] });
      assert.equal(created.statusCode, 201);
      assert.equal(created.body.status, status);
      assert.equal(db.products[0].stock, 0);
      assert.equal(db.products[1].stock, 3);
      assert.equal(db.products[1].reserved, 3);
      assert.equal(db.auditLog[0].action, 'ORDER_CREATED');
      var writesBeforeRejection = writes;
      assert.equal(post('/orders', { items: [{ id: 1, qty: 1 }] }).statusCode, 409);
      assert.equal(writes, writesBeforeRejection);
      var cancelled = post('/orders/:id/cancel', { reason: 'Customer request' }, { id: String(created.body.id) });
      assert.equal(cancelled.statusCode, 200);
      assert.equal(cancelled.body.status, 'cancelled');
      assert.equal(JSON.stringify(db.products), before);
      assert.equal(db.auditLog[0].action, 'ORDER_CANCELLED');
      var afterCancel = JSON.stringify(db);
      assert.equal(post('/orders/:id/cancel', {}, { id: created.body.id }).statusCode, 400);
      assert.equal(JSON.stringify(db), afterCancel);
      assert.equal(writes, writesBeforeRejection + 1);
    });
    assert.equal(writes, 4);
  } finally {
    store.read = originalRead;
    store.write = originalWrite;
    dates.today = originalToday;
  }
});
