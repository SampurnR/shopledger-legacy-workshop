var test = require('node:test');
var assert = require('node:assert/strict');
var store = require('../lib/store');
var router = require('../routes/orders');

function withOrderRoute(run) {
  var originalRead = store.read;
  var originalWrite = store.write;
  var db = {
    products: [{ id: 1, name: 'Rice', price: 100, hsn: '1006', stock: 20, reserved: 0 }],
    customers: [{ id: 1, name: 'Meera', openingBalance: 0, totalBilled: 0, totalSettled: 0, balance: 0, creditLimit: 5000 }],
    orders: [], auditLog: [], nextOrderId: 1001
  };
  var writes = 0;
  var layer = router.stack.find(function (entry) {
    return entry.route && entry.route.path === '/orders' && entry.route.methods.post;
  });
  // Return the fixture itself so even unsaved mutations are detected. Neither
  // storage function accesses the checked-in database during these tests.
  store.read = function () { return db; };
  store.write = function () { writes++; };
  function post(fields) {
    var body = Object.assign({ items: [{ id: 1, qty: 1 }], customerId: 1 }, fields);
    var res = { statusCode: 200 };
    res.status = function (code) { this.statusCode = code; return this; };
    res.json = function (value) { this.body = value; return this; };
    layer.route.stack[0].handle({ body: body }, res);
    return res;
  }
  try {
    run(db, post, function () { return writes; });
  } finally {
    store.read = originalRead;
    store.write = originalWrite;
  }
}

test('invalid creation statuses reject before stock, khata, audit or ID mutations', function () {
  ['cancelled', 'unknown', '', null, 1, {}, []].forEach(function (status) {
    withOrderRoute(function (db, post, writes) {
      var before = JSON.stringify(db);
      var res = post({ status: status, paymentMode: 'khata' });
      assert.equal(res.statusCode, 400);
      assert.match(res.body.error, /status/i);
      assert.equal(JSON.stringify(db), before);
      assert.equal(writes(), 0);
    });
  });
});

test('invalid payment modes reject without any mutations or writes', function () {
  ['card', 'neft', 'unknown', '', null, 1, {}, []].forEach(function (paymentMode) {
    withOrderRoute(function (db, post, writes) {
      var before = JSON.stringify(db);
      var res = post({ paymentMode: paymentMode });
      assert.equal(res.statusCode, 400);
      assert.match(res.body.error, /payment mode/i);
      assert.equal(JSON.stringify(db), before);
      assert.equal(writes(), 0);
    });
  });
});

test('supported creation statuses and payment modes retain stock and khata effects', function () {
  ['completed', 'pending'].forEach(function (status) {
    ['cash', 'upi', 'khata', 'UPI'].forEach(function (mode) {
      withOrderRoute(function (db, post, writes) {
        var res = post({ status: status, paymentMode: mode });
        assert.equal(res.statusCode, 201);
        assert.equal(res.body.status, status);
        assert.equal(res.body.paymentMode, mode.toLowerCase());
        assert.equal(db.products[0].stock, 19);
        assert.equal(db.customers[0].totalBilled, mode === 'khata' ? res.body.total : 0);
        assert.equal(db.orders.length, 1);
        assert.equal(db.auditLog[0].action, 'ORDER_CREATED');
        assert.equal(writes(), 1);
      });
    });
  });
});

test('omitted status and payment mode default to completed and cash', function () {
  withOrderRoute(function (db, post) {
    var res = post({});
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.status, 'completed');
    assert.equal(res.body.paymentMode, 'cash');
  });
});
