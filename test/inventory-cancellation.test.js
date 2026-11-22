'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

test('CORRECT BEHAVIOUR — a sale can consume all currently sellable stock', function () {
  var ghee = { id: 6, name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 };
  var chilli = { id: 11, name: 'Byadgi Kashmiri Chilli Powder 500g', stock: 4, reserved: 3 };

  assert.deepEqual(inventory.check([ghee], [{ id: 6, qty: 1 }]), { ok: true });
  assert.deepEqual(inventory.check([chilli], [{ id: 11, qty: 1 }]), { ok: true });

  inventory.reserve([ghee], [{ id: 6, qty: 1 }]);
  inventory.reserve([chilli], [{ id: 11, qty: 1 }]);

  assert.equal(inventory.getSellableStock(ghee), 0);
  assert.equal(inventory.getSellableStock(chilli), 0);
});

test('CORRECT BEHAVIOUR — cancelling a pending order returns its quantities to physical stock', function () {
  var db = {
    products: [
      { id: 6, name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 },
      { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', stock: 20, reserved: 4 }
    ],
    customers: [{
      id: 4,
      name: 'Suresh Deshmukh',
      openingBalance: 0,
      totalBilled: 1407,
      totalSettled: 0
    }],
    orders: [{
      id: 1007,
      status: 'pending',
      paymentMode: 'khata',
      customerId: 4,
      total: 1407,
      items: [
        { id: 6, name: 'A2 Gir Cow Ghee 500ml', qty: 2 },
        { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', qty: 2 }
      ]
    }]
  };

  var result = orders.cancel(db, 1007, 'Cancelled from Order History');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(db.products[0].stock, 3);
  assert.equal(db.products[1].stock, 22);
  assert.equal(db.products[0].reserved, 0);
  assert.equal(db.products[1].reserved, 4);
});
