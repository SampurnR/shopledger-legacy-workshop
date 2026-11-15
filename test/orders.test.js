'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var orders = require('../lib/orders');
var fixtures = require('../test-support/fixtures');

function ids(list) { return list.map(function (order) { return order.id; }); }

test('CURRENT BEHAVIOUR: history sorts by day text instead of chronology', function () {
  assert.deepEqual(ids(orders.list(fixtures.orderDb())), [1004, 1001, 1006, 1008, 1003, 1002, 1007, 1005]);
});

test('CURRENT BEHAVIOUR: January range incorrectly includes all eight orders', function () {
  assert.deepEqual(ids(orders.list(fixtures.orderDb(), { from: '2022-01-01', to: '2022-01-31' })), [1004, 1001, 1006, 1008, 1003, 1002, 1007, 1005]);
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
