var test = require('node:test');
var assert = require('node:assert/strict');

var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

test('A quantity equal to remaining sellable stock can be sold', function () {
  var products = [
    { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 },
    { id: 12, sku: 'SPC-001', name: 'Byadgi Chilli Powder', stock: 4, reserved: 3 }
  ];

  assert.deepEqual(inventory.check(products, [{ id: 6, qty: 1 }]), { ok: true });
  assert.deepEqual(inventory.check(products, [{ id: 12, qty: 1 }]), { ok: true });
});

test('Cancelling a pending order returns its items to physical stock', function () {
  var db = {
    products: [{ id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', stock: 3, reserved: 0 }],
    customers: [],
    orders: [{
      id: 1007,
      status: 'pending',
      paymentMode: 'cash',
      items: [{ id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', qty: 2 }],
      total: 900
    }]
  };

  var result = orders.cancel(db, 1007, 'Cancelled from order history');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(db.products[0].stock, 5);
  assert.equal(db.products[0].reserved, 0);
});


