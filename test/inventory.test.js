var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

test('allows selling the exact remaining sellable stock', function () {
  var products = [
    { id: 1, name: 'A2 Gir Cow Ghee 500ml', sku: 'DRY-001', stock: 1, reserved: 0 },
    { id: 2, name: 'Byadgi Chilli Powder', sku: 'SPC-001', stock: 4, reserved: 3 }
  ];

  assert.deepEqual(inventory.check([products[0]], [{ id: 1, qty: 1 }]), { ok: true });
  assert.deepEqual(inventory.check([products[1]], [{ id: 2, qty: 1 }]), { ok: true });
});

test('cancelling an order restores its decremented stock without changing reservations', function () {
  var db = {
    products: [{ id: 2, name: 'Byadgi Chilli Powder', stock: 3, reserved: 3 }],
    orders: [{
      id: 1007,
      status: 'pending',
      paymentMode: 'cash',
      items: [{ id: 2, qty: 1 }],
      total: 500
    }]
  };

  var result = orders.cancel(db, 1007);

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(db.products[0].stock, 4);
  assert.equal(db.products[0].reserved, 3);
});
