'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var orders = require('../lib/orders');
var fixtures = require('../test-support/fixtures');

function ids(list) { return list.map(function (order) { return order.id; }); }

test('history sorts all eight orders newest first across months and years', function () {
  assert.deepEqual(ids(orders.list(fixtures.orderDb())), [1008, 1007, 1006, 1005, 1004, 1003, 1002, 1001]);
});

test('January ISO range includes only the three January orders', function () {
  assert.deepEqual(ids(orders.list(fixtures.orderDb(), { from: '2022-01-01', to: '2022-01-31' })), [1004, 1003, 1002]);
});

test('from-only range excludes earlier months', function () {
  assert.deepEqual(ids(orders.list(fixtures.orderDb(), { from: '2022-02-01' })), [1008, 1007, 1006, 1005]);
});

test('to-only range includes older years and excludes later months', function () {
  assert.deepEqual(ids(orders.list(fixtures.orderDb(), { to: '2022-01-31' })), [1004, 1003, 1002, 1001]);
});

test('day-first date filters include both boundaries', function () {
  assert.deepEqual(ids(orders.list(fixtures.orderDb(), { from: '05/01/2022', to: '14/01/2022' })), [1003, 1002]);
});

test('same-day range includes its exact order date', function () {
  assert.deepEqual(ids(orders.list(fixtures.orderDb(), { from: '2022-01-14', to: '2022-01-14' })), [1003]);
});

test('date, status and search filters can be combined', function () {
  assert.deepEqual(ids(orders.list(fixtures.orderDb(), { from: '2022-03-01', to: '2022-03-31', status: 'pending', search: 'suresh' })), [1007]);
});

test('same-date orders keep their input order', function () {
  assert.deepEqual(ids(orders.list({ orders: [{ id: 1, date: '01/01/2022' }, { id: 2, date: '01/01/2022' }] })), [1, 2]);
});

test('history compares ISO and day-first stored dates consistently', function () {
  var db = { orders: [{ id: 1, date: '31/12/2021' }, { id: 2, date: '2022-01-01' }, { id: 3, date: '02/01/2022' }] };
  assert.deepEqual(ids(orders.list(db)), [3, 2, 1]);
});

test('a reversed date range returns no orders', function () {
  assert.deepEqual(orders.list(fixtures.orderDb(), { from: '2022-03-01', to: '2022-01-01' }), []);
});

test('listing does not mutate the source order array', function () {
  var db = fixtures.orderDb();
  var before = structuredClone(db);
  assert.notEqual(orders.list(db), db.orders);
  assert.deepEqual(db, before);
});

test('status filtering retains the pending order', function () {
  assert.deepEqual(ids(orders.list(fixtures.orderDb(), { status: 'pending' })), [1007]);
});

test('coupon search is case-insensitive and trims whitespace', function () {
  assert.deepEqual(ids(orders.list(fixtures.orderDb(), { search: ' save10 ' })), [1004, 1002]);
});

test('customer search and order ID search retain matching records', function () {
  assert.deepEqual(ids(orders.list(fixtures.orderDb(), { search: 'MEERA' })).sort(), [1001, 1006]);
  assert.deepEqual(ids(orders.list(fixtures.orderDb(), { search: '1007' })), [1007]);
});

test('empty history and unmatched filters return an empty array', function () {
  assert.deepEqual(orders.list({ orders: [] }), []);
  assert.deepEqual(orders.list(fixtures.orderDb(), { search: 'absent' }), []);
});

test('order lookup supports route string IDs and missing IDs', function () {
  assert.equal(orders.get(fixtures.orderDb(), '1007').id, 1007);
  assert.equal(orders.get(fixtures.orderDb(), '9999'), null);
});
