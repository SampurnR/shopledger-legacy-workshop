var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

test('CURRENT BEHAVIOUR: rejects selling exactly the remaining sellable unit', function () {
  var products = [
    { id: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 },
    { id: 'SPC-001', name: 'Byadgi Chilli Powder', stock: 4, reserved: 3 }
  ];

  assert.deepEqual(inventory.check(products, [{ id: 'DRY-001', qty: 1 }]), {
    ok: false,
    msg: 'A2 Gir Cow Ghee 500ml is out of stock (1 sellable available)'
  });
  assert.deepEqual(inventory.check(products, [{ id: 'SPC-001', qty: 1 }]), {
    ok: false,
    msg: 'Byadgi Chilli Powder is out of stock (1 sellable available)'
  });
});

test('CURRENT BEHAVIOUR: cancelling an order with id-based items does not restore stock', function () {
  var db = {
    orders: [{
      id: 1007,
      status: 'pending',
      paymentMode: 'cash',
      items: [{ id: 'DRY-001', qty: 1 }]
    }],
    products: [{ id: 'DRY-001', stock: 0, reserved: 0 }]
  };

  var result = orders.cancel(db, 1007, 'staff cancellation');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(db.products[0].stock, 0);
  assert.equal(db.products[0].reserved, 0);
});
