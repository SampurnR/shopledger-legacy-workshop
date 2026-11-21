var assert = require('node:assert/strict');
var test = require('node:test');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

test('checkout can buy the last sellable unit without consuming reservations', function () {
  var products = [
    { id: 6, name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 },
    { id: 11, name: 'Byadgi Chilli Powder', stock: 4, reserved: 3 }
  ];

  var items = [{ id: 6, qty: 1 }, { id: 11, qty: 1 }];
  assert.deepEqual(inventory.check(products, items), { ok: true });
  inventory.reserve(products, items);
  assert.deepEqual(products.map(function (product) { return [product.stock, product.reserved]; }), [[0, 0], [3, 3]]);
  assert.deepEqual(inventory.check(products, [{ id: 11, qty: 1 }]), {
    ok: false, msg: 'Byadgi Chilli Powder is out of stock (0 sellable available)'
  });
});

test('checkout rejects repeated lines that together exceed sellable stock', function () {
  var products = [{ id: 11, name: 'Byadgi Chilli Powder', stock: 4, reserved: 3 }];
  var items = [{ id: 11, qty: 1 }, { id: '11', qty: 1 }];

  assert.deepEqual(inventory.check(products, items), {
    ok: false, msg: 'Byadgi Chilli Powder is out of stock (1 sellable available)'
  });
});

test('cancelling pending order 1007 restores physical stock once and reverses the Khata debit', function () {
  var db = {
    products: [{ id: 6, stock: 1, reserved: 0 }, { id: 4, stock: 22, reserved: 4 }],
    orders: [{
      id: 1007, status: 'pending', paymentMode: 'khata', customerId: 4, total: 1407,
      items: [{ id: 6, qty: 2 }, { id: 4, qty: 2 }]
    }],
    customers: [{ id: 4, openingBalance: 0, totalBilled: 1500, totalSettled: 0 }]
  };

  var result = orders.cancel(db, 1007);
  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(orders.cancel(db, 1007).ok, false);
  assert.deepEqual(db.products, [{ id: 6, stock: 3, reserved: 0 }, { id: 4, stock: 24, reserved: 4 }]);
  assert.equal(db.customers[0].balance, 93);
});
