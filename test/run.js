var assert = require('node:assert/strict');
var test = require('node:test');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

function makeOrderDb(status) {
  return {
    products: [
      { id: 6, sku: 'DRY-001', stock: 1, reserved: 0 },
      { id: 4, sku: 'OIL-001', stock: 22, reserved: 4 }
    ],
    orders: [{
      id: 1007,
      customer: 'Suresh Deshmukh',
      customerId: 4,
      paymentMode: 'khata',
      status: status || 'pending',
      total: 1407,
      items: [
        { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', qty: 2 },
        { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', qty: 2 }
      ]
    }],
    customers: [{ id: 4, openingBalance: 0, totalBilled: 1407, totalSettled: 0, balance: 1407 }]
  };
}

test('orders can consume all remaining sellable stock for DRY-001 and SPC-001', function () {
  var cases = [
    { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 },
    { id: 11, sku: 'SPC-001', name: 'Byadgi Kashmiri Chilli Powder 500g', stock: 4, reserved: 3 }
  ];

  cases.forEach(function (product) {
    var products = [product];
    var items = [{ id: product.id, qty: 1 }];

    assert.deepStrictEqual(inventory.check(products, items), { ok: true }, product.sku);
    inventory.reserve(products, items);
    assert.equal(product.stock, product.reserved, product.sku + ' must retain reserved stock');
  });
});

test('orders exceeding sellable stock are rejected without changing inventory', function () {
  var products = [{ id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 }];
  var result = inventory.check(products, [{ id: 6, qty: 2 }]);

  assert.equal(result.ok, false);
  assert.equal(products[0].stock, 1);
  assert.equal(products[0].reserved, 0);
});

test('reserved stock remains protected while the last unreserved unit can be sold', function () {
  var products = [{ id: 11, sku: 'SPC-001', name: 'Byadgi Kashmiri Chilli Powder 500g', stock: 4, reserved: 3 }];
  var items = [{ id: 11, qty: 1 }];

  assert.deepStrictEqual(inventory.check(products, items), { ok: true });
  inventory.reserve(products, items);
  assert.equal(products[0].stock, 3);
  assert.equal(products[0].reserved, 3);
  assert.equal(inventory.getSellableStock(products[0]), 0);
  assert.equal(inventory.check(products, [{ id: 11, qty: 1 }]).ok, false);
});

test('cancelling pending Order #1007 restores each deducted item and preserves reservations', function () {
  var db = makeOrderDb();
  var result = orders.cancel(db, 1007, 'Customer cancelled');

  assert.equal(result.ok, true);
  assert.equal(db.products[0].stock, 3);
  assert.equal(db.products[0].reserved, 0);
  assert.equal(db.products[1].stock, 24);
  assert.equal(db.products[1].reserved, 4);
  assert.equal(db.orders[0].status, 'cancelled');
  assert.equal(db.customers[0].totalBilled, 0);
});

test('cancelling the same order twice restores inventory only once', function () {
  var db = makeOrderDb();

  assert.equal(orders.cancel(db, 1007, 'First cancellation').ok, true);
  var result = orders.cancel(db, 1007, 'Second cancellation');

  assert.equal(result.ok, false);
  assert.match(result.error, /already cancelled/);
  assert.equal(db.products[0].stock, 3);
  assert.equal(db.products[1].stock, 24);
});

test('an already-cancelled order does not restore inventory', function () {
  var db = makeOrderDb('cancelled');
  var result = orders.cancel(db, 1007, 'Repeated cancellation');

  assert.equal(result.ok, false);
  assert.match(result.error, /already cancelled/);
  assert.equal(db.products[0].stock, 1);
  assert.equal(db.products[1].stock, 22);
  assert.equal(db.customers[0].totalBilled, 1407);
});

test('an invalid order ID leaves inventory unchanged', function () {
  var db = makeOrderDb();
  var result = orders.cancel(db, 9999, 'Unknown order');

  assert.deepStrictEqual(result, { ok: false, error: 'Order not found' });
  assert.equal(db.products[0].stock, 1);
  assert.equal(db.products[1].stock, 22);
  assert.equal(db.orders[0].status, 'pending');
});

test('a failed inventory restoration leaves every product and the order unchanged', function () {
  var db = makeOrderDb();
  db.products = db.products.slice(0, 1);
  var result = orders.cancel(db, 1007, 'Customer cancelled');

  assert.equal(result.ok, false);
  assert.equal(db.products[0].stock, 1);
  assert.equal(db.orders[0].status, 'pending');
  assert.equal(db.customers[0].totalBilled, 1407);
});

test('cancelling an order with no inventory movements does not increase stock', function () {
  var db = makeOrderDb();
  db.orders[0].items = [];
  var result = orders.cancel(db, 1007, 'Customer cancelled before items were committed');

  assert.equal(result.ok, true);
  assert.equal(db.products[0].stock, 1);
  assert.equal(db.products[1].stock, 22);
  assert.equal(db.orders[0].status, 'cancelled');
});

test('releasing a reservation frees reserved quantity without increasing physical stock', function () {
  var products = [{ id: 6, stock: 1, reserved: 1 }];

  inventory.release(products, [{ productId: 6, qty: 1 }]);

  assert.equal(products[0].stock, 1);
  assert.equal(products[0].reserved, 0);
});

test('cancellation restores physical lines and releases reservation lines independently', function () {
  var db = {
    products: [
      { id: 1, stock: 5, reserved: 2 },
      { id: 2, stock: 10, reserved: 3 }
    ],
    orders: [{
      id: 2001,
      status: 'pending',
      items: [
        { id: 1, qty: 2 },
        { productId: 2, qty: 2 }
      ]
    }]
  };
  var result = orders.cancel(db, 2001, 'Mixed inventory cancellation');

  assert.equal(result.ok, true);
  assert.equal(db.products[0].stock, 7);
  assert.equal(db.products[0].reserved, 2);
  assert.equal(db.products[1].stock, 10);
  assert.equal(db.products[1].reserved, 1);
  assert.equal(db.orders[0].status, 'cancelled');
});

test('reservation release is capped at the reserved quantity', function () {
  var products = [{ id: 6, stock: 5, reserved: 1 }];

  assert.equal(inventory.release(products, [{ productId: 6, qty: 3 }]), true);

  assert.equal(products[0].stock, 5);
  assert.equal(products[0].reserved, 0);
  assert.ok(products[0].reserved >= 0);
});
