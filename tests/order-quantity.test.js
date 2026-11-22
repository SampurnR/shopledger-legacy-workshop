var assert = require('node:assert/strict');
var test = require('node:test');
var store = require('../lib/store');
var orderRoutes = require('../routes/orders');

var db;
var writes;

// Keep these API tests isolated from the project's persistent data/db.json.
store.read = function () {
  return db;
};
store.write = function () {
  writes++;
};
store.appendAudit = function () {};

var postOrderHandler = orderRoutes.stack.filter(function (layer) {
  return layer.route && layer.route.path === '/orders' && layer.route.methods.post;
})[0].route.stack[0].handle;

function postOrder(payload) {
  var response = {
    statusCodeValue: 200,
    body: null,
    status: function (code) {
      this.statusCodeValue = code;
      return this;
    },
    json: function (body) {
      this.body = body;
      return this;
    }
  };

  postOrderHandler({ body: payload }, response);
  return { status: response.statusCodeValue, body: response.body };
}

function resetDb() {
  writes = 0;
  db = {
    nextOrderId: 1001,
    products: [{
      id: 1,
      sku: 'TEST-001',
      name: 'Test rice',
      hsn: '1006',
      price: 100,
      stock: 10,
      reserved: 0
    }],
    orders: [],
    customers: [{
      id: 7,
      name: 'Test customer',
      creditLimit: 1000,
      openingBalance: 0,
      totalBilled: 0,
      totalSettled: 0
    }],
    settlements: [],
    auditLog: []
  };
}

test('rejects invalid quantities without changing business data', async function (t) {
  for (var quantity of [0, -2, 1.5, '2abc', Number.POSITIVE_INFINITY]) {
    await t.test('quantity ' + quantity, async function () {
      resetDb();
      var before = JSON.parse(JSON.stringify(db));

      var result = postOrder({
        items: [{ id: 1, qty: quantity }],
        paymentMode: 'khata',
        customerId: 7
      });

      assert.equal(result.status, 400);
      assert.match(result.body.error, /quantity must be a finite positive integer/i);
      assert.deepEqual(db, before);
      assert.equal(writes, 0);
    });
  }
});

test('keeps a valid one-unit checkout working', async function () {
  resetDb();

  var result = postOrder({
    items: [{ id: 1, qty: 1 }],
    paymentMode: 'cash'
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.items[0].qty, 1);
  assert.equal(db.products[0].stock, 9);
  assert.equal(db.orders.length, 1);
  assert.equal(db.orders[0].total, 105);
  assert.equal(writes, 1);
});
