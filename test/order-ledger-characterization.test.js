'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');

test('order history sorts DD/MM/YYYY dates chronologically, newest first', function () {
  var db = {
    orders: [
      { id: 1, date: '01/03/2024' },
      { id: 2, date: '20/02/2024' },
      { id: 3, date: '15/01/2024' }
    ]
  };

  var result = orders.list(db, {});

  assert.deepEqual(result.map(function (order) { return order.id; }), [1, 2, 3]);
});

test('date range filters include only orders on or between the requested dates', function () {
  var db = {
    orders: [
      { id: 1, date: '15/01/2024' },
      { id: 2, date: '15/02/2024' },
      { id: 3, date: '15/03/2024' }
    ]
  };

  var fromFebruary = orders.list(db, { from: '2024-02-01' });
  var throughFebruary = orders.list(db, { to: '2024-02-29' });

  assert.deepEqual(fromFebruary.map(function (order) { return order.id; }), [3, 2]);
  assert.deepEqual(throughFebruary.map(function (order) { return order.id; }), [2, 1]);
});

test('Khata settlement adds a request string amount numerically to the customer balance', function () {
  var db = {
    nextSettlementId: 501,
    customers: [{
      id: 7,
      name: 'Asha Stores',
      openingBalance: 0,
      totalBilled: 100,
      totalSettled: 20
    }],
    settlements: []
  };

  // routes/customers.js passes body.amount through without converting its string value.
  var result = ledger.recordSettlement(db, '7', '5.00', 'upi', 'Part payment');

  assert.equal(result.ok, true);
  assert.equal(db.customers[0].totalSettled, 25);
  assert.equal(db.customers[0].balance, 75);
  assert.equal(result.settlement.amount, 5);
  assert.equal(db.settlements.length, 1);
});
