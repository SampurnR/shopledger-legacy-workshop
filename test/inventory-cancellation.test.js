'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

const ORDER_ID = 1001;

function makeDatabase(status, products, items) {
  return {
    products: products,
    orders: [{
      id: ORDER_ID,
      status: status,
      paymentMode: 'cash',
      customerId: null,
      items: items,
      total: 100
    }],
    customers: []
  };
}

function captureWarnings(callback) {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = function (message) {
    warnings.push(String(message));
  };

  try {
    callback();
  } finally {
    console.warn = originalWarn;
  }

  return warnings;
}

test('cancelling a normal order restores physical stock', function () {
  const products = [{ id: 1, stock: 10, reserved: 0 }];
  const items = [{ id: 1, qty: 3 }];
  const db = makeDatabase('completed', products, items);

  inventory.reserve(db.products, items);
  assert.equal(products[0].stock, 7);

  const result = orders.cancel(db, ORDER_ID, 'test cancellation');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(products[0].stock, 10);
});

test('cancelling an order restores each product quantity', function () {
  const products = [
    { id: 1, stock: 12, reserved: 0 },
    { id: 2, stock: 20, reserved: 0 }
  ];
  const items = [{ id: 1, qty: 3 }, { id: 2, qty: 4 }];
  const db = makeDatabase('completed', products, items);
  const originalStock = products.map(function (product) { return product.stock; });

  inventory.reserve(db.products, items);
  const result = orders.cancel(db, ORDER_ID);

  assert.equal(result.ok, true);
  assert.deepEqual(products.map(function (product) { return product.stock; }), originalStock);
});

test('cancellation does not change reserved stock', function () {
  const products = [{ id: 1, stock: 10, reserved: 5 }];
  const items = [{ id: 1, qty: 3 }];
  const db = makeDatabase('completed', products, items);

  inventory.reserve(db.products, items);
  const result = orders.cancel(db, ORDER_ID);

  assert.equal(result.ok, true);
  assert.equal(products[0].stock, 10);
  assert.equal(products[0].reserved, 5);
});

test('pending and completed orders can both be cancelled', async function (t) {
  for (const status of ['pending', 'completed']) {
    await t.test(status + ' order restores stock', function () {
      const products = [{ id: 1, stock: 8, reserved: 0 }];
      const items = [{ id: 1, qty: 2 }];
      const db = makeDatabase(status, products, items);

      inventory.reserve(db.products, items);
      const result = orders.cancel(db, ORDER_ID);

      assert.equal(result.ok, true);
      assert.equal(result.order.status, 'cancelled');
      assert.equal(products[0].stock, 8);
    });
  }
});

test('duplicate cancellation is rejected without restoring stock twice', function () {
  const products = [{ id: 1, stock: 10, reserved: 0 }];
  const items = [{ id: 1, qty: 3 }];
  const db = makeDatabase('completed', products, items);

  inventory.reserve(db.products, items);
  const firstResult = orders.cancel(db, ORDER_ID);
  const stockAfterFirstCancellation = products[0].stock;
  const secondResult = orders.cancel(db, ORDER_ID);

  assert.equal(firstResult.ok, true);
  assert.equal(secondResult.ok, false);
  assert.match(secondResult.error, /already cancelled/);
  assert.equal(products[0].stock, stockAfterFirstCancellation);
  assert.equal(products[0].stock, 10);
});

test('invalid release items are ignored and reported with warnings', function () {
  const products = [{ id: 1, stock: 10, reserved: 2 }];
  const invalidItems = [
    { qty: 2 },
    { id: 999, qty: 2 },
    { id: 1, qty: 0 },
    { id: 1, qty: -1 },
    { id: 1, qty: 'not-a-number' },
    { id: 1, qty: true },
    { id: 1, qty: NaN },
    { id: 1, qty: Infinity },
    { id: 1, qty: -Infinity },
    { id: 1, qty: 'Infinity' }
  ];

  const warnings = captureWarnings(function () {
    inventory.release(products, invalidItems);
  });

  assert.equal(products[0].stock, 10);
  assert.equal(products[0].reserved, 2);
  assert.equal(warnings.length, invalidItems.length);
});

test('non-array release inputs are ignored without throwing', function () {
  const invalidCollections = ['not-an-array', {}, null, undefined];

  for (const items of invalidCollections) {
    const products = [{ id: 1, stock: 10, reserved: 2 }];
    const warnings = captureWarnings(function () {
      assert.doesNotThrow(function () {
        inventory.release(products, items);
      });
    });

    assert.equal(products[0].stock, 10);
    assert.equal(products[0].reserved, 2);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /items must be an array/);
  }
});

test('invalid starting stock and overflowing restoration are left unchanged', function () {
  const products = [
    { id: 1, stock: 'not-a-number', reserved: 0 },
    { id: 2, stock: Infinity, reserved: 0 },
    { id: 3, stock: NaN, reserved: 0 },
    { id: 4, stock: Number.MAX_VALUE, reserved: 0 }
  ];
  const warnings = captureWarnings(function () {
    inventory.release(products, [
      { id: 1, qty: 1 },
      { id: 2, qty: 1 },
      { id: 3, qty: 1 },
      { id: 4, qty: Number.MAX_VALUE }
    ]);
  });

  assert.equal(products[0].stock, 'not-a-number');
  assert.equal(products[1].stock, Infinity);
  assert.equal(Number.isNaN(products[2].stock), true);
  assert.equal(products[3].stock, Number.MAX_VALUE);
  assert.equal(Number.isFinite(products[3].stock), true);
  assert.equal(warnings.length, 4);
});
