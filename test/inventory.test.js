var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

function fixture(stock, reserved, qty) {
  var product = {
    id: 1,
    sku: 'TEST-01',
    name: 'Test product',
    hsn: '1006',
    price: 100,
    stock: stock,
    reserved: reserved
  };
  // Match the order line stored by routes/orders.js, which uses id.
  var item = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    hsn: product.hsn,
    price: product.price,
    qty: qty
  };
  return {
    db: { products: [product], orders: [], nextOrderId: 1001 },
    product: product,
    items: [item]
  };
}

function placeOrder(cart) {
  assert.deepEqual(inventory.check(cart.db.products, cart.items), { ok: true });
  inventory.reserve(cart.db.products, cart.items);
  return orders.add(cart.db, { items: cart.items });
}

test('accepts a quantity below sellable stock', function () {
  var cart = fixture(10, 0, 9);
  assert.deepEqual(inventory.check(cart.db.products, cart.items), { ok: true });
});

test('accepts a quantity equal to sellable stock', function () {
  var cart = fixture(10, 0, 10);
  assert.deepEqual(inventory.check(cart.db.products, cart.items), { ok: true });
});

test('rejects a quantity above sellable stock', function () {
  var cart = fixture(10, 0, 11);
  assert.deepEqual(inventory.check(cart.db.products, cart.items), {
    ok: false,
    msg: 'Test product is out of stock (10 sellable available)'
  });
});

test('accepts the exact sellable quantity with wholesale reservations', function () {
  var cart = fixture(10, 3, 7);
  assert.equal(inventory.getSellableStock(cart.product), 7);
  assert.deepEqual(inventory.check(cart.db.products, cart.items), { ok: true });
});

test('rejects an order when all physical stock is reserved', function () {
  var cart = fixture(3, 3, 1);
  assert.equal(inventory.getSellableStock(cart.product), 0);
  assert.deepEqual(inventory.check(cart.db.products, cart.items), {
    ok: false,
    msg: 'Test product is out of stock (0 sellable available)'
  });
});

test('deducts physical stock on placement and preserves wholesale reservations', function () {
  var cart = fixture(10, 3, 2);
  var order = placeOrder(cart);
  assert.equal(cart.db.orders[0], order);
  assert.equal(cart.product.stock, 8);
  assert.equal(cart.product.reserved, 3);
  assert.equal(inventory.getSellableStock(cart.product), 5);
});

test('cancelling a stored order restores physical stock using its line item id', function () {
  var cart = fixture(10, 3, 2);
  var order = placeOrder(cart);
  assert.equal(cart.product.stock, 8);
  assert.equal(order.items[0].id, cart.product.id);
  assert.equal(Object.hasOwn(order.items[0], 'productId'), false);

  var result = orders.cancel(cart.db, order.id, 'Test cancellation');

  assert.equal(result.ok, true);
  assert.equal(order.status, 'cancelled');
  assert.equal(cart.product.stock, 10);
});

test('cancelling an order preserves wholesale reservations', function () {
  var cart = fixture(10, 3, 2);
  var order = placeOrder(cart);

  assert.equal(orders.cancel(cart.db, order.id).ok, true);
  assert.equal(cart.product.reserved, 3);
});

test('repeated cancellation cannot restore stock more than once', function () {
  var cart = fixture(10, 3, 2);
  var order = placeOrder(cart);

  assert.equal(orders.cancel(cart.db, order.id).ok, true);
  var stockAfterCancellation = cart.product.stock;

  assert.deepEqual(orders.cancel(cart.db, order.id), {
    ok: false,
    error: 'Order #' + order.id + ' is already cancelled'
  });
  assert.equal(cart.product.stock, stockAfterCancellation);
  assert.equal(cart.product.reserved, 3);
});
