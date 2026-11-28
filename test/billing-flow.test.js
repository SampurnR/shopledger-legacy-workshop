var test = require('node:test');
var assert = require('node:assert/strict');
var store = require('../lib/store');

// Fail closed: no test in this file can reach the JSON persistence methods.
test.mock.method(store, 'read', function () { throw new Error('In-memory store required'); });
test.mock.method(store, 'write', function () { throw new Error('In-memory store required'); });

var orderRoutes = require('../routes/orders');
var reportRoutes = require('../routes/reports');
var app = require('../server');

function fixture(t) {
  var db = {
    nextOrderId: 1, orders: [], auditLog: [],
    products: [{ id: 1, sku: 'TEST', name: 'Test rice', hsn: '1006', gstRate: 12, price: 500, stock: 10 }],
    customers: [{ id: 1, name: 'Test customer', creditLimit: 10000, totalBilled: 0, totalSettled: 0 }]
  };
  var state = { db: db, writes: 0 };
  t.mock.method(store, 'read', function () { return db; });
  t.mock.method(store, 'write', function (value) {
    assert.equal(value, db);
    state.writes++;
  });
  return state;
}

// Invoke the real synchronous handlers without opening sockets or starting server.js.
function request(router, method, path, body, params) {
  var stack = router.stack || router._router.stack;
  var layer = stack.find(function (entry) {
    return entry.route && entry.route.path === path && entry.route.methods[method];
  });
  assert.ok(layer, 'route exists: ' + method + ' ' + path);
  var response = {
    statusCode: 200,
    status: function (code) { this.statusCode = code; return this; },
    json: function (value) { this.body = value; return this; },
    send: function (value) { this.body = value; return this; }
  };
  layer.route.stack[0].handle({ body: body || {}, params: params || {}, query: {} }, response);
  return response;
}

test('preview, khata billing and invoice agree on HSN totals (product GST override is still dropped)', function (t) {
  var state = fixture(t);
  var body = { items: [{ id: 1, qty: 1 }], coupon: ' save10 ', paymentMode: 'khata', customerId: 1 };
  var preview = request(reportRoutes, 'post', '/pricing/preview', body);
  assert.equal(preview.body.couponStatus.code, 'SAVE10');
  assert.deepEqual([
    preview.body.totals.subtotal, preview.body.totals.discount,
    preview.body.totals.tax, preview.body.totals.total
  ], [500, 50, 22.5, 472.5]);
  var created = request(orderRoutes, 'post', '/orders', body);
  assert.equal(created.statusCode, 201);
  assert.deepEqual(created.body.items, [{ id: 1, sku: 'TEST', name: 'Test rice', hsn: '1006', price: 500, qty: 1 }]);
  assert.deepEqual([created.body.subtotal, created.body.discount, created.body.tax, created.body.total], [500, 50, 22.5, 472.5]);
  assert.equal(created.body.coupon, 'SAVE10');
  assert.equal(created.body.customer, 'Test customer');
  ['cgst', 'sgst', 'taxable', 'lines'].forEach(function (key) {
    assert.equal(Object.hasOwn(created.body, key), false, key + ' is not persisted');
  });
  assert.equal(state.db.customers[0].totalBilled, 472.5);
  assert.equal(state.db.customers[0].balance, 472.5);
  assert.equal(state.db.products[0].stock, 9);
  assert.equal(state.writes, 1);
  assert.equal(state.db.auditLog[0].action, 'ORDER_CREATED');
  var printed = request(app, 'get', '/orders/:id/invoice', null, { id: 1 });
  assert.equal(printed.statusCode, 200);
  assert.match(printed.body, /Invoice Total<\/td><td class="r">₹472\.50/);
  assert.match(printed.body, /Total GST\)<\/td><td class="r">₹22\.50/);
  assert.doesNotMatch(printed.body, /Accountant Reconciliation Notice/);
  assert.equal(state.db.orders[0].total, 472.5);
  assert.equal(state.writes, 1);
});

[
  { code: 'missing', price: 500, error: 'Invalid coupon code: MISSING', total: 525 },
  { code: 'DIWALI20', price: 1000, error: 'Coupon DIWALI20 has expired', total: 1050 },
  { code: 'SAVE10', price: 100, error: 'Coupon SAVE10 requires a minimum order subtotal of ₹500', total: 105 }
].forEach(function (sample) {
  test('preview reports invalid coupon while order creation rejects it: ' + sample.code, function (t) {
    var state = fixture(t);
    state.db.products[0].price = sample.price;
    var body = { items: [{ id: 1, qty: 1 }], coupon: sample.code };
    var preview = request(reportRoutes, 'post', '/pricing/preview', body);
    assert.equal(preview.statusCode, 200);
    assert.deepEqual(preview.body.couponStatus, { valid: false, error: sample.error });
    assert.equal(preview.body.totals.discount, 0);
    assert.equal(preview.body.totals.total, sample.total);
    var created = request(orderRoutes, 'post', '/orders', body);
    assert.equal(created.statusCode, 400);
    assert.deepEqual(created.body, { error: sample.error });
    assert.equal(state.db.orders.length, 0);
    assert.equal(state.db.products[0].stock, 10);
    assert.equal(state.writes, 0);
  });
});

test('CURRENT BEHAVIOUR: preview accepts fractional quantity while billed order truncates it', function (t) {
  fixture(t);
  var body = { items: [{ id: 1, qty: 1.5 }] };
  var preview = request(reportRoutes, 'post', '/pricing/preview', body);
  var created = request(orderRoutes, 'post', '/orders', body);
  assert.equal(preview.body.totals.total, 787.5);
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.items[0].qty, 1);
  assert.equal(created.body.total, 525);
});

test('invoice endpoint returns 404 for an absent in-memory order', function (t) {
  fixture(t);
  var result = request(app, 'get', '/orders/:id/invoice', null, { id: 99 });
  assert.equal(result.statusCode, 404);
  assert.equal(result.body, 'Order not found');
});
