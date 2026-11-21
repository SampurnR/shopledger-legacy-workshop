var test = require('node:test');
var assert = require('node:assert/strict');

var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

test('stock check allows buying the exact sellable quantity', function () {
  var products = [{
    id: 6,
    name: 'A2 Gir Cow Ghee 500ml',
    stock: 1,
    reserved: 0
  }];

  var result = inventory.check(products, [{ id: 6, qty: 1 }]);

  assert.deepEqual(result, { ok: true });
});

test('cancelling an order restores its quantity to physical stock', function () {
  var db = {
    products: [{ id: 7, name: 'Butter', stock: 4, reserved: 0 }],
    orders: [{
      id: 1007,
      status: 'pending',
      paymentMode: 'cash',
      items: [{ id: 7, name: 'Butter', qty: 2 }],
      total: 582.4
    }],
    customers: []
  };

  var result = orders.cancel(db, 1007, 'Customer cancelled');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(db.products[0].stock, 6);
  assert.equal(db.products[0].reserved, 0);
});
