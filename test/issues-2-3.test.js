'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var ledger = require('../lib/ledger');
var orders = require('../lib/orders');

function sampleOrders() {
  return [
    { id: 1001, date: '28/12/2021' },
    { id: 1002, date: '05/01/2022' },
    { id: 1003, date: '14/01/2022' },
    { id: 1004, date: '30/01/2022' },
    { id: 1005, date: '02/02/2022' },
    { id: 1006, date: '18/02/2022' },
    { id: 1007, date: '04/03/2022' },
    { id: 1008, date: '15/03/2022' }
  ];
}

test('order history sorts newest first by calendar date', function () {
  var result = orders.list({ orders: sampleOrders() }, { status: 'all' });

  assert.deepEqual(result.map(function (order) { return order.id; }), [1008, 1007, 1006, 1005, 1004, 1003, 1002, 1001]);
});

test('order history date range includes only dates inside the requested range', function () {
  var result = orders.list({ orders: sampleOrders() }, {
    status: 'all',
    from: '2022-01-01',
    to: '2022-01-31'
  });

  assert.deepEqual(result.map(function (order) { return order.id; }), [1004, 1003, 1002]);
});

test('Khata settlement adds a numeric amount and updates the balance', function () {
  var db = {
    nextSettlementId: 505,
    customers: [{
      id: 1,
      name: 'Meera Joshi',
      openingBalance: 450,
      totalBilled: 1982.01,
      totalSettled: 1200,
      creditLimit: 5000
    }],
    settlements: []
  };

  var result = ledger.recordSettlement(db, 1, '500', 'upi', 'test');

  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
});

test('inventory accepts an order for the exact remaining sellable stock', function () {
  var products = [{ id: 6, name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 }];
  var result = inventory.check(products, [{ id: 6, qty: 1 }]);

  assert.equal(result.ok, true);
});

test('cancelling an order restores its deducted stock', function () {
  var db = {
    products: [{ id: 6, name: 'A2 Gir Cow Ghee 500ml', stock: 2, reserved: 0 }],
    orders: [{
      id: 1007,
      status: 'pending',
      paymentMode: 'cash',
      total: 900,
      items: [{ id: 6, name: 'A2 Gir Cow Ghee 500ml', price: 450, qty: 2 }]
    }]
  };

  var result = orders.cancel(db, 1007, 'test cancellation');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(db.products[0].stock, 4);
});
