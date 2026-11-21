var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

// In-memory test fixtures - NEVER touch data/db.json
function createMockProducts() {
  return [
    {
      id: 6,
      sku: 'DRY-001',
      name: 'A2 Gir Cow Ghee 500ml',
      price: 450,
      stock: 1,
      reserved: 0
    },
    {
      id: 11,
      sku: 'SPC-001',
      name: 'Byadgi Kashmiri Chilli Powder 500g',
      price: 220,
      stock: 4,
      reserved: 3
    },
    {
      id: 1,
      sku: 'GRN-001',
      name: 'Indrayani Basmati Rice 5kg',
      price: 640,
      stock: 18,
      reserved: 2
    },
    {
      id: 4,
      sku: 'OIL-001',
      name: 'Cold-Pressed Sunflower Oil 1L',
      price: 190,
      stock: 22,
      reserved: 4
    }
  ];
}

function createMockDb() {
  return {
    nextOrderId: 1009,
    products: createMockProducts(),
    customers: [
      {
        id: 4,
        name: 'Suresh Deshmukh',
        openingBalance: 0,
        totalBilled: 1407,
        totalSettled: 0,
        balance: 1407
      }
    ],
    orders: [
      {
        id: 1007,
        date: '04/03/2022',
        customer: 'Suresh Deshmukh',
        customerId: 4,
        paymentMode: 'khata',
        status: 'pending',
        items: [
          { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', price: 450, qty: 2 },
          { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', price: 190, qty: 2 }
        ],
        subtotal: 1280,
        discount: 0,
        tax: 127,
        total: 1407
      }
    ]
  };
}

test('getSellableStock calculates sellable stock correctly excluding wholesale reservations', function () {
  var products = createMockProducts();
  // DRY-001: stock 1, reserved 0 -> 1
  assert.equal(inventory.getSellableStock(products[0]), 1);
  // SPC-001: stock 4, reserved 3 -> 1
  assert.equal(inventory.getSellableStock(products[1]), 1);
  // GRN-001: stock 18, reserved 2 -> 16
  assert.equal(inventory.getSellableStock(products[2]), 16);
  // Reserved exceeds stock -> 0
  assert.equal(inventory.getSellableStock({ stock: 2, reserved: 5 }), 0);
  // Missing product -> 0
  assert.equal(inventory.getSellableStock(null), 0);
});

test('check passes when quantity is strictly less than sellable stock', function () {
  var products = createMockProducts();
  // GRN-001 has 16 sellable units; requesting 15 should pass
  var result = inventory.check(products, [{ id: 1, qty: 15 }]);
  assert.deepEqual(result, { ok: true });
});

test('check rejects when quantity exceeds sellable stock', function () {
  var products = createMockProducts();
  // GRN-001 has 16 sellable units; requesting 17 should fail
  var result = inventory.check(products, [{ id: 1, qty: 17 }]);
  assert.equal(result.ok, false);
  assert.equal(result.msg, 'Indrayani Basmati Rice 5kg is out of stock (16 sellable available)');
});

test('CURRENT BEHAVIOUR: check falsely rejects buying exact remaining sellable stock (last sellable unit)', function () {
  var products = createMockProducts();

  // DRY-001 has 1 sellable unit (stock: 1, reserved: 0)
  // Current bug: items[i].qty >= sellable rejects 1 unit with "out of stock (1 sellable available)"
  var gheeResult = inventory.check(products, [{ id: 6, qty: 1 }]);
  assert.equal(gheeResult.ok, false);
  assert.equal(gheeResult.msg, 'A2 Gir Cow Ghee 500ml is out of stock (1 sellable available)');

  // SPC-001 has 1 sellable unit (stock: 4, reserved: 3)
  // Current bug: rejects 1 unit with "out of stock (1 sellable available)"
  var chilliResult = inventory.check(products, [{ id: 11, qty: 1 }]);
  assert.equal(chilliResult.ok, false);
  assert.equal(chilliResult.msg, 'Byadgi Kashmiri Chilli Powder 500g is out of stock (1 sellable available)');
});

test('reserve decrements physical stock for ordered items', function () {
  var products = createMockProducts();
  inventory.reserve(products, [{ id: 1, qty: 3 }]);
  var p = inventory.find(products, 1);
  assert.equal(p.stock, 15);
});

test('CURRENT BEHAVIOUR: release fails to restore stock when line items have id property', function () {
  var products = createMockProducts();
  var ghee = inventory.find(products, 6);
  assert.equal(ghee.stock, 1);

  // Line items from order cancellation use `id`, but release looks for `productId`
  inventory.release(products, [{ id: 6, qty: 2 }]);

  // Stock remains 1 in unfixed code because release looks up items[i].productId (undefined)
  assert.equal(ghee.stock, 1);
});

test('CURRENT BEHAVIOUR: release decrements reserved instead of restoring stock when productId is used', function () {
  var products = createMockProducts();
  var chilli = inventory.find(products, 11);
  assert.equal(chilli.stock, 4);
  assert.equal(chilli.reserved, 3);

  // Even if productId is provided, unfixed code decrements reserved instead of restoring stock
  inventory.release(products, [{ productId: 11, qty: 2 }]);

  assert.equal(chilli.stock, 4); // stock not restored
  assert.equal(chilli.reserved, 1); // reserved incorrectly modified
});

test('CURRENT BEHAVIOUR: cancelling an order in orders.cancel does not restore product stock', function () {
  var db = createMockDb();
  var ghee = inventory.find(db.products, 6);
  var oil = inventory.find(db.products, 4);

  assert.equal(ghee.stock, 1);
  assert.equal(oil.stock, 22);

  var cancelResult = orders.cancel(db, 1007, 'Customer requested cancellation');
  assert.equal(cancelResult.ok, true);
  assert.equal(cancelResult.order.status, 'cancelled');

  // In unfixed code, order is cancelled but product stock is NEVER restored
  assert.equal(ghee.stock, 1);
  assert.equal(oil.stock, 22);
});
