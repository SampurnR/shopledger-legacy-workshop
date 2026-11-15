var test = require('node:test');
var assert = require('node:assert/strict');
var orderRouter = require('../routes/orders');
var customerRouter = require('../routes/customers');
var reportRouter = require('../routes/reports');
var helpers = require('./helpers');

test('current behavior: checkout uses stored prices, records an order and deducts physical stock', function (t) {
  var harness = helpers.createRouteHarness(t);
  var response = harness.invoke(orderRouter, 'post', '/orders', {
    items: [{ id: 1, price: 1, qty: 1 }], customer: 'Walk-in Test'
  });
  assert.equal(response.statusCode, 201);
  assert.deepEqual([response.body.id, response.body.items[0].price, response.body.total], [1001, 640, 672]);
  assert.equal(response.body.date, '15/04/2022');
  var saved = harness.db();
  assert.deepEqual([saved.products[0].stock, saved.products[0].reserved], [17, 2]);
  assert.equal(saved.nextOrderId, 1002);
  assert.equal(saved.orders.length, 1);
  assert.equal(saved.auditLog[0].action, 'ORDER_CREATED');
  assert.equal(harness.writes(), 1);
  assert.equal(saved.customers[0].totalBilled, 500);
});

test('current behavior: rejected checkout requests do not persist changes', function (t) {
  var harness = helpers.createRouteHarness(t);
  var before = harness.db();
  var scenarios = [
    [{ items: [] }, 400],
    [{ items: [{ id: 999, qty: 1 }] }, 400],
    [{ items: [{ id: 1, qty: 16 }] }, 409],
    [{ items: [{ id: 1, qty: 1 }], coupon: 'UNKNOWN' }, 400],
    [{ items: [{ id: 1, qty: 1 }], paymentMode: 'khata' }, 400],
    [{ items: [{ id: 1, qty: 1 }], paymentMode: 'khata', customerId: 999 }, 409]
  ];
  scenarios.forEach(function (scenario) {
    var response = harness.invoke(orderRouter, 'post', '/orders', scenario[0]);
    assert.equal(response.statusCode, scenario[1]);
    assert.equal(typeof response.body.error, 'string');
    assert.deepEqual(harness.db(), before);
  });
  assert.equal(harness.writes(), 0);
});

test('current behavior: a Khata credit-limit rejection does not deduct stock or save an order', function (t) {
  var db = helpers.createDb();
  db.customers[0].creditLimit = 1000;
  var harness = helpers.createRouteHarness(t, db);
  var response = harness.invoke(orderRouter, 'post', '/orders', {
    items: [{ id: 1, qty: 1 }], customerId: 1, paymentMode: 'khata'
  });
  assert.equal(response.statusCode, 409);
  assert.deepEqual(harness.db(), db);
  assert.equal(harness.writes(), 0);
});

test('current behavior: pending orders immediately deduct stock and charge registered Khata', function (t) {
  var harness = helpers.createRouteHarness(t);
  var response = harness.invoke(orderRouter, 'post', '/orders', {
    items: [{ id: 1, qty: 1 }], customerId: 1, customer: 'Ignored', paymentMode: 'khata', status: 'pending'
  });
  assert.equal(response.statusCode, 201);
  assert.deepEqual([response.body.status, response.body.customer], ['pending', 'Test Customer']);
  assert.deepEqual([harness.db().products[0].stock, harness.db().customers[0].balance], [17, 1122]);
});

test('known behavior: invalid quantity defaults to one and fractional quantity is truncated', function (t) {
  var harness = helpers.createRouteHarness(t);
  var response = harness.invoke(orderRouter, 'post', '/orders', {
    items: [{ id: 1, qty: -4 }, { id: 2, qty: 2.9 }]
  });
  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.body.items.map(function (item) { return item.qty; }), [1, 2]);
});

test('known defect: cancelled-on-creation orders still deduct stock and charge Khata', function (t) {
  var harness = helpers.createRouteHarness(t);
  var response = harness.invoke(orderRouter, 'post', '/orders', {
    items: [{ id: 1, qty: 1 }], customerId: 1, paymentMode: 'khata', status: 'cancelled'
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.status, 'cancelled');
  assert.deepEqual([harness.db().products[0].stock, harness.db().customers[0].balance], [17, 1122]);
});

test('known defect: checkout drops an explicit product GST override', function (t) {
  var db = helpers.createDb();
  db.products[0].gstRate = 12;
  var harness = helpers.createRouteHarness(t, db);
  var response = harness.invoke(orderRouter, 'post', '/orders', { items: [{ id: 1, qty: 1 }] });
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.tax, 32);
  assert.equal(response.body.items[0].gstRate, undefined);
});

test('known defect: cancellation persists its audit and credit reversal without restoring stock', function (t) {
  var harness = helpers.createRouteHarness(t);
  harness.invoke(orderRouter, 'post', '/orders', {
    items: [{ id: 1, qty: 1 }], customerId: 1, paymentMode: 'khata'
  });
  var response = harness.invoke(orderRouter, 'post', '/orders/:id/cancel', { reason: 'test' }, { id: '1001' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'cancelled');
  assert.deepEqual([harness.db().products[0].stock, harness.db().customers[0].balance], [17, 450]);
  assert.equal(harness.db().auditLog[0].action, 'ORDER_CANCELLED');
  assert.equal(harness.writes(), 2);
  assert.equal(harness.invoke(orderRouter, 'post', '/orders/:id/cancel', {}, { id: '1001' }).statusCode, 400);
  assert.equal(harness.writes(), 2);
});

test('REGRESSION: settlement route persists numeric totals for string amounts', function (t) {
  var harness = helpers.createRouteHarness(t);
  var response = harness.invoke(customerRouter, 'post', '/customers/:id/settle',
    { amount: '50', mode: 'upi' }, { id: '1' });
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.settlement.amount, 50);
  assert.equal(harness.db().customers[0].totalSettled, 150);
  assert.equal(harness.db().customers[0].balance, 400);
  assert.equal(harness.db().auditLog[0].action, 'KHATA_SETTLEMENT');
});

test('current behavior: preview ignores unknown products and falls back after an invalid coupon', function (t) {
  var harness = helpers.createRouteHarness(t);
  var response = harness.invoke(reportRouter, 'post', '/pricing/preview', {
    items: [{ id: 1, qty: 1 }, { id: 999, qty: 1 }], coupon: 'UNKNOWN'
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.couponStatus.valid, false);
  assert.deepEqual([response.body.totals.discount, response.body.totals.total], [0, 672]);
  assert.equal(harness.writes(), 0);
});
