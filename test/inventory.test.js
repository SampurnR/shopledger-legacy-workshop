var test = require('node:test');
var assert = require('node:assert/strict');

var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

function product(overrides) {
  var base = {
    id: 1,
    sku: 'SKU-001',
    name: 'Test Product',
    hsn: '1006',
    price: 100,
    stock: 1,
    reserved: 0
  };
  return Object.assign(base, overrides || {});
}

function lineItem(id, qty) {
  // This is the shape created by routes/orders.js before persistence.
  return {
    id: id,
    sku: 'SKU-001',
    name: 'Test Product',
    hsn: '1006',
    price: 100,
    qty: qty
  };
}

test('CURRENT BEHAVIOUR: inventory.check allows qty 1 when sellable stock is 1', function () {
  var result = inventory.check([product()], [lineItem(1, 1)]);

  assert.deepEqual(result, { ok: true });
});

test('CURRENT BEHAVIOUR: inventory.check rejects qty 2 when sellable stock is 1', function () {
  var result = inventory.check([product()], [lineItem(1, 2)]);

  assert.deepEqual(result, {
    ok: false,
    msg: 'Test Product is out of stock (1 sellable available)'
  });
});

test('CURRENT BEHAVIOUR: inventory.check allows qty 0 when sellable stock is 1', function () {
  var result = inventory.check([product()], [lineItem(1, 0)]);

  assert.deepEqual(result, { ok: true });
});

test('CURRENT BEHAVIOUR: inventory.check allows qty 1 when stock 4 with reserved 3 leaves one sellable unit', function () {
  var reservedProduct = product({ stock: 4, reserved: 3 });

  assert.equal(inventory.getSellableStock(reservedProduct), 1);
  assert.deepEqual(inventory.check([reservedProduct], [lineItem(1, 1)]), { ok: true });
});

test('CURRENT BEHAVIOUR: reserve then cancel restores physical stock without changing reserved', function () {
  var db = {
    products: [product({ id: 7, stock: 5, reserved: 0 })],
    orders: [],
    customers: []
  };
  var order = {
    id: 101,
    date: '01/01/2022',
    customer: 'Walk-in',
    customerId: null,
    paymentMode: 'cash',
    status: 'pending',
    items: [lineItem(7, 1)],
    coupon: '',
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  };
  db.orders.push(order);

  var states = {
    before: { stock: db.products[0].stock, reserved: db.products[0].reserved }
  };

  inventory.reserve(db.products, order.items);
  states.afterReserve = { stock: db.products[0].stock, reserved: db.products[0].reserved };

  var result = orders.cancel(db, order.id, 'Characterization test');
  states.afterCancel = { stock: db.products[0].stock, reserved: db.products[0].reserved };

  assert.equal(result.ok, true);
  assert.equal(order.status, 'cancelled');
  assert.deepEqual(states, {
    before: { stock: 5, reserved: 0 },
    afterReserve: { stock: 4, reserved: 0 },
    afterCancel: { stock: 5, reserved: 0 }
  });
});

test('CORRECT BEHAVIOUR: allows the last sellable unit and restores stock exactly once on cancellation', function () {
  var db = {
    products: [product({ id: 7, stock: 4, reserved: 3 })],
    orders: [],
    customers: []
  };
  var order = {
    id: 102,
    date: '01/01/2022',
    customer: 'Walk-in',
    customerId: null,
    paymentMode: 'cash',
    status: 'pending',
    items: [lineItem(7, 1)],
    coupon: '',
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  };
  db.orders.push(order);

  assert.deepEqual(inventory.check(db.products, order.items), { ok: true });

  inventory.reserve(db.products, order.items);
  assert.deepEqual(db.products[0], product({ id: 7, stock: 3, reserved: 3 }));

  assert.equal(orders.cancel(db, order.id, 'Correct behaviour test').ok, true);
  assert.deepEqual(db.products[0], product({ id: 7, stock: 4, reserved: 3 }));

  assert.equal(orders.cancel(db, order.id, 'Second cancellation').ok, false);
  assert.deepEqual(db.products[0], product({ id: 7, stock: 4, reserved: 3 }));
});
