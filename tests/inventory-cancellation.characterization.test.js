var test = require('node:test');
var assert = require('node:assert/strict');

var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

function product(overrides) {
  return Object.assign({
    id: 1,
    name: 'Fixture Rice',
    stock: 10,
    reserved: 3
  }, overrides || {});
}

function orderLine(overrides) {
  return Object.assign({
    id: 1,
    sku: 'FIX-001',
    name: 'Fixture Rice',
    hsn: '1006',
    price: 100,
    qty: 2
  }, overrides || {});
}

function cancellationDb(overrides) {
  return Object.assign({
    products: [product({ stock: 8, reserved: 3 })],
    orders: [{
      id: 41,
      date: '01/01/2026',
      customer: 'Walk-in',
      customerId: null,
      paymentMode: 'cash',
      status: 'completed',
      items: [orderLine()],
      total: 200
    }],
    customers: []
  }, overrides || {});
}

test('getSellableStock subtracts reserved units and floors at zero', function () {
  assert.equal(inventory.getSellableStock(product()), 7);
  assert.equal(inventory.getSellableStock(product({ stock: 2, reserved: 5 })), 0);
  assert.equal(inventory.getSellableStock(null), 0);
});

test('check accepts quantities below sellable stock and rejects quantity equal to sellable stock', function () {
  var products = [product()];

  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 6 }]), { ok: true });
  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 7 }]), {
    ok: false,
    msg: 'Fixture Rice is out of stock (7 sellable available)'
  });
});

test('check rejects an unknown product ID', function () {
  assert.deepEqual(inventory.check([product()], [{ id: 99, qty: 1 }]), {
    ok: false,
    msg: 'Unknown product 99'
  });
});

test('reserve deducts physical stock using the order-line id and leaves reserved unchanged', function () {
  var item = product();

  inventory.reserve([item], [orderLine({ qty: 2 })]);

  assert.equal(item.stock, 8);
  assert.equal(item.reserved, 3);
});

test('release restores physical stock for actual order lines and leaves reserved unchanged', function () {
  var item = product({ stock: 8, reserved: 3 });

  inventory.release([item], [orderLine({ qty: 2 })]);

  assert.equal(item.stock, 10);
  assert.equal(item.reserved, 3);
});

test('cancel transitions a non-cancelled order and records cancellation metadata', function () {
  var db = cancellationDb();

  var result = orders.cancel(db, 41, 'Customer request');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(result.order.cancelReason, 'Customer request');
  assert.match(result.order.cancelledAt, /^\d{2}\/\d{2}\/\d{4}$/);
});

test('REGRESSION: cancelling an id-based order restores only its deducted physical stock once', function () {
  var db = cancellationDb({
    products: [
      product({ stock: 8, reserved: 3 }),
      product({ id: 2, name: 'Unrelated Dal', stock: 50, reserved: 6 })
    ]
  });

  var firstCancellation = orders.cancel(db, 41, 'Regression run');

  // The order line uses the same id property created in routes/orders.js.
  assert.equal(firstCancellation.ok, true);
  assert.equal(db.products[0].stock, 10);
  assert.equal(db.products[0].reserved, 3);
  assert.equal(db.products[1].stock, 50);
  assert.equal(db.products[1].reserved, 6);

  var repeatedCancellation = orders.cancel(db, 41, 'Repeat attempt');

  assert.equal(repeatedCancellation.ok, false);
  assert.equal(repeatedCancellation.error, 'Order #41 is already cancelled');
  assert.equal(db.products[0].stock, 10);
});

test('cancel reverses the Khata debit for a Khata order', function () {
  var db = cancellationDb({
    customers: [{
      id: 7,
      name: 'Fixture Wholesale',
      openingBalance: 0,
      totalBilled: 200,
      totalSettled: 0,
      balance: 200
    }],
    orders: [{
      id: 42,
      date: '01/01/2026',
      customer: 'Fixture Wholesale',
      customerId: 7,
      paymentMode: 'khata',
      status: 'completed',
      items: [orderLine()],
      total: 200
    }]
  });

  var result = orders.cancel(db, 42, 'Customer request');

  assert.equal(result.ok, true);
  assert.equal(db.customers[0].totalBilled, 0);
  assert.equal(db.customers[0].balance, 0);
});
