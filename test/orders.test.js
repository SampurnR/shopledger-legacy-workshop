'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var orders = require('../lib/orders');

test('adding an order assigns and increments the next ID', function () {
  var db = { nextOrderId: 1001, orders: [] };
  var order = orders.add(db, {
    customer: 'Walk-in',
    items: [{ id: 1, name: 'Rice', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  });

  assert.equal(order.id, 1001);
  assert.equal(order.status, 'completed');
  assert.equal(db.nextOrderId, 1002);
  assert.equal(db.orders[0], order);
});

test('cancel marks an order cancelled and releases its Khata debit', function () {
  var db = {
    nextOrderId: 1002,
    orders: [{
      id: 1001,
      status: 'completed',
      paymentMode: 'khata',
      customerId: 7,
      total: 100,
      items: [{ id: 1, qty: 1 }]
    }],
    products: [{ id: 1, stock: 4, reserved: 0 }],
    customers: [{ id: 7, openingBalance: 0, totalBilled: 100, totalSettled: 0 }]
  };

  var result = orders.cancel(db, 1001, 'Customer returned goods');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(db.customers[0].totalBilled, 0);
});

test('current cancellation does not restore physical stock deducted at placement', function () {
  var db = {
    nextOrderId: 1002,
    orders: [{
      id: 1001,
      status: 'completed',
      paymentMode: 'cash',
      total: 10,
      items: [{ id: 1, qty: 1 }]
    }],
    products: [{ id: 1, stock: 4, reserved: 0 }]
  };

  orders.cancel(db, 1001, 'Characterize current inventory behavior');

  assert.equal(db.products[0].stock, 4);
});
