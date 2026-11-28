'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var orders = require('../lib/orders');
var dates = require('../lib/dates');

function database(orderDates) {
  return {
    orders: orderDates.map(function (date, index) {
      return { id: index + 1, date: date, status: 'completed' };
    })
  };
}

test('order history sorts DD/MM/YYYY dates newest first chronologically', function () {
  var db = database(['10/02/2024', '02/01/2024', '15/12/2023']);

  var result = orders.list(db, {});

  assert.deepEqual(result.map(function (order) { return order.id; }), [1, 2, 3]);
});

test('from-date filtering includes only orders on or after the ISO date', function () {
  var db = database(['31/01/2024', '01/02/2024', '02/02/2024']);

  var result = orders.list(db, { from: '2024-02-01' });

  assert.deepEqual(result.map(function (order) { return order.id; }).sort(), [2, 3]);
});

test('to-date filtering includes only orders on or before the ISO date', function () {
  var db = database(['31/01/2024', '01/02/2024', '02/02/2024']);

  var result = orders.list(db, { to: '2024-01-31' });

  assert.deepEqual(result.map(function (order) { return order.id; }).sort(), [1]);
});

test('date normalization accepts ISO dates and preserves stored DD/MM/YYYY dates', function () {
  assert.equal(dates.normalizeDateKey('2024-02-01'), '01/02/2024');
  assert.equal(dates.normalizeDateKey('31/01/2024'), '31/01/2024');
});
