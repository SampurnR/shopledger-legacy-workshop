var test = require('node:test');
var assert = require('node:assert/strict');
var dates = require('../lib/dates');
var orders = require('../lib/orders');
var router = require('../routes/orders');
var helpers = require('./helpers');

// Regression assertions cover chronological sorting and inclusive date ranges.
// Use only synthetic fixtures: no shop records or filesystem persistence.
function createHistory() {
  var db = helpers.createDb();
  db.orders = [
    { id: 1, date: '28/12/2021', customer: 'Test Account', status: 'completed' },
    { id: 2, date: '05/01/2022', customer: 'Test Account' },
    { id: 3, date: '30/01/2022', customer: 'Test Account', status: 'pending' },
    { id: 4, date: '02/02/2022', customer: 'Test Account', status: 'cancelled' }
  ];
  return db;
}

function ids(list) {
  return list.map(function (order) { return order.id; });
}

test('CURRENT BEHAVIOUR: date normalization produces day-first strings without validating dates', function () {
  assert.equal(dates.normalizeDateKey(' 2022-01-05 '), '05/01/2022');
  assert.equal(dates.normalizeDateKey(' 05/01/2022 '), '05/01/2022');
  assert.equal(dates.normalizeDateKey('2022-99-99'), '99/99/2022');
  assert.equal(dates.normalizeDateKey('not-a-date'), 'date/a/not');
  assert.equal(dates.normalizeDateKey(''), '');
});

test('CURRENT BEHAVIOUR: same-month order history appears newest first', function () {
  var db = createHistory();
  db.orders = [db.orders[1], db.orders[2]];
  assert.deepEqual(ids(orders.list(db)), [3, 2]);
});

test('REGRESSION: history sorts chronologically across months and years', function () {
  var db = createHistory();
  var before = helpers.clone(db);
  assert.deepEqual(ids(orders.list(db)), [4, 3, 2, 1]);
  assert.deepEqual(db, before, 'Listing must not reorder the stored array');
});

test('REGRESSION: January date range excludes December and February orders', function () {
  var db = createHistory();
  assert.deepEqual(ids(orders.list(db, { from: '2022-01-01', to: '2022-01-31' })), [3, 2]);
  assert.deepEqual(ids(orders.list(db, { from: '01/01/2022', to: '31/01/2022' })), [3, 2]);
});

test('REGRESSION: cross-year date range retains both included endpoints', function () {
  var db = createHistory();
  assert.deepEqual(ids(orders.list(db, { from: '2021-12-28', to: '2022-01-05' })), [2, 1]);
});

test('REGRESSION: from-only filtering includes later orders and excludes earlier orders', function () {
  assert.deepEqual(ids(orders.list(createHistory(), { from: '2022-01-10' })), [4, 3]);
});

test('REGRESSION: to-only filtering includes earlier orders and excludes later orders', function () {
  assert.deepEqual(ids(orders.list(createHistory(), { to: '2022-01-10' })), [2, 1]);
});

test('CURRENT BEHAVIOUR: equal date bounds include an order on the boundary', function () {
  assert.deepEqual(ids(orders.list(createHistory(), { from: '2022-01-05', to: '2022-01-05' })), [2]);
});

test('REGRESSION: status and trimmed case-insensitive search combine with the chronological range', function () {
  assert.deepEqual(ids(orders.list(createHistory(), {
    status: 'completed', search: ' TEST ACCOUNT ', from: '2022-01-01', to: '2022-01-31'
  })), [2]);
});

test('REGRESSION: order history route returns chronological query results without writes', function (t) {
  var harness = helpers.createRouteHarness(t, createHistory());
  var before = harness.db();
  var response = harness.invoke(router, 'get', '/orders', null, null, {
    status: 'completed', search: 'test account', from: '2022-01-01', to: '2022-01-31'
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(ids(response.body), [2]);
  assert.deepEqual(harness.db(), before);
  assert.equal(harness.writes(), 0);
});
