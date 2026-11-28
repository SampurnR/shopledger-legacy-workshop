var test = require('node:test');
var assert = require('node:assert/strict');

var orders = require('../lib/orders');

test('cancelling an order restores its purchased quantities to physical stock', function () {
  var db = {
    products: [{ id: 1, name: 'Rice', stock: 4, reserved: 1 }],
    customers: [],
    orders: [{
      id: 1001,
      status: 'completed',
      paymentMode: 'cash',
      items: [{ id: 1, name: 'Rice', qty: 2 }],
      total: 200
    }]
  };

  var result = orders.cancel(db, 1001, 'Customer request');

  assert.equal(result.ok, true);
  assert.equal(db.products[0].stock, 6);
  assert.equal(db.products[0].reserved, 1);
});

test('cancelling twice cannot restore stock twice', function () {
  var db = {
    products: [{ id: 1, name: 'Rice', stock: 4, reserved: 0 }],
    customers: [],
    orders: [{
      id: 1001,
      status: 'completed',
      paymentMode: 'cash',
      items: [{ id: 1, name: 'Rice', qty: 2 }],
      total: 200
    }]
  };

  assert.equal(orders.cancel(db, 1001, 'Customer request').ok, true);
  assert.deepEqual(orders.cancel(db, 1001, 'Again'), {
    ok: false,
    error: 'Order #1001 is already cancelled'
  });
  assert.equal(db.products[0].stock, 6);
});
