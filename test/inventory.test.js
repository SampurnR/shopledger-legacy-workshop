var assert = require('node:assert/strict');
var test = require('node:test');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

test('stock check at the sellable limit with and without wholesale holds', function () {
  var products = [
    { id: 1, name: 'Ghee', stock: 1 },
    { id: 2, name: 'Chilli', stock: 4, reserved: 3 }
  ];

  products.forEach(function (product) {
    var items = [{ id: product.id, qty: 1 }];
    assert.equal(inventory.check(products, items).ok, true);
    assert.equal(inventory.check(products, [{ id: product.id, qty: 2 }]).ok, false);
    inventory.reserve(products, items);
    assert.equal(inventory.getSellableStock(product), 0);
    assert.equal(inventory.check(products, items).ok, false);
  });
});

test('stock check counts repeated lines against the same sellable stock', function () {
  var products = [{ id: 2, stock: 5, reserved: 3 }];
  var items = [{ id: 2, qty: 1 }, { id: '2', qty: 1 }];
  assert.equal(inventory.check(products, items).ok, true);
  items.push({ id: 2, qty: 1 });
  assert.equal(inventory.check(products, items).ok, false);
});

test('cancelling a pending order created with standard line items', function () {
  var product = { id: 2, stock: 5, reserved: 3 };
  var db = { products: [product], orders: [], nextOrderId: 1007 };
  var items = [{ id: 2, qty: 1 }];
  inventory.reserve(db.products, items);
  var order = orders.add(db, { status: 'pending', items: items });
  assert.equal(product.stock, 4);

  assert.equal(orders.cancel(db, order.id).ok, true);
  assert.equal(order.status, 'cancelled');
  assert.equal(product.stock, 5);
  assert.equal(product.reserved, 3);

  assert.equal(orders.cancel(db, order.id).ok, false);
  assert.equal(product.stock, 5);
});

test('release accepts the productId line item format', function () {
  var product = { id: 2, stock: 4, reserved: 3 };
  inventory.release([product], [{ productId: 2, qty: 1 }]);
  assert.equal(product.stock, 5);
  assert.equal(product.reserved, 3);
});
