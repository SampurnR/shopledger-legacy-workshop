var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

test('Inventory Module - Ticket 2 (#2 / #435) Characterization & Fix Suite', function (t) {
  function createProductFixture() {
    return [
      { id: 1, name: 'Indrayani Basmati Rice 5kg', stock: 18, reserved: 2 },
      { id: 6, name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 },
      { id: 7, name: 'Byadgi Kashmiri Chilli Powder 500g', stock: 4, reserved: 3 },
      { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', stock: 2, reserved: 0 }
    ];
  }

  t.test('Sellable stock calculation correctly deducts reserved units', function () {
    var products = createProductFixture();
    assert.equal(inventory.getSellableStock(products[0]), 16); // 18 - 2
    assert.equal(inventory.getSellableStock(products[1]), 1);  // 1 - 0
    assert.equal(inventory.getSellableStock(products[2]), 1);  // 4 - 3
    assert.equal(inventory.getSellableStock(null), 0);
  });

  t.test('Can sell the last sellable unit when physical=1, reserved=0 (Issue #2)', function () {
    var products = createProductFixture();
    var checkRes = inventory.check(products, [{ id: 6, qty: 1 }]);
    assert.equal(checkRes.ok, true, 'Should allow buying exact 1 sellable unit');
  });

  t.test('Can sell the last sellable unit when physical=4, reserved=3 (Issue #2)', function () {
    var products = createProductFixture();
    var checkRes = inventory.check(products, [{ id: 7, qty: 1 }]);
    assert.equal(checkRes.ok, true, 'Should allow buying remaining 1 sellable unit when 3 reserved');
  });

  t.test('Can sell exact remaining sellable stock on any SKU', function () {
    var products = createProductFixture();
    var checkRes = inventory.check(products, [{ id: 1, qty: 16 }]);
    assert.equal(checkRes.ok, true, 'Should allow buying all 16 sellable units');
  });

  t.test('Rejects when requested quantity strictly exceeds sellable stock', function () {
    var products = createProductFixture();
    var checkRes = inventory.check(products, [{ id: 6, qty: 2 }]);
    assert.equal(checkRes.ok, false);
    assert.match(checkRes.msg, /is out of stock \(1 sellable available\)/);
  });

  t.test('Rejects unknown products in inventory check', function () {
    var products = createProductFixture();
    var checkRes = inventory.check(products, [{ id: 999, qty: 1 }]);
    assert.equal(checkRes.ok, false);
    assert.match(checkRes.msg, /Unknown product 999/);
  });

  t.test('Reserve decrements physical stock', function () {
    var products = createProductFixture();
    inventory.reserve(products, [{ id: 6, qty: 1 }, { id: 4, qty: 2 }]);
    assert.equal(products[1].stock, 0);
    assert.equal(products[3].stock, 0);
  });

  t.test('Release restores physical stock for items with id (Issue #2)', function () {
    var products = createProductFixture();
    inventory.reserve(products, [{ id: 6, qty: 1 }]);
    assert.equal(products[1].stock, 0);
    assert.equal(inventory.getSellableStock(products[1]), 0);

    inventory.release(products, [{ id: 6, qty: 1 }]);
    assert.equal(products[1].stock, 1);
    assert.equal(inventory.getSellableStock(products[1]), 1);
  });

  t.test('Release restores physical stock for items with productId', function () {
    var products = createProductFixture();
    inventory.release(products, [{ productId: 4, qty: 5 }]);
    assert.equal(products[3].stock, 7);
  });

  t.test('Cancelling an order restores physical and sellable stock (Issue #2 Order #1007)', function () {
    var mockDb = {
      nextOrderId: 1008,
      products: createProductFixture(),
      orders: [
        {
          id: 1007,
          customer: 'Suresh Deshmukh',
          status: 'pending',
          paymentMode: 'cash',
          items: [
            { id: 6, name: 'A2 Gir Cow Ghee 500ml', qty: 2 },
            { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', qty: 2 }
          ]
        }
      ]
    };

    var gheeBefore = mockDb.products[1].stock;
    var oilBefore = mockDb.products[3].stock;

    var cancelRes = orders.cancel(mockDb, 1007, 'Customer requested cancellation');
    assert.equal(cancelRes.ok, true);
    assert.equal(cancelRes.order.status, 'cancelled');

    assert.equal(mockDb.products[1].stock, gheeBefore + 2, 'Ghee physical stock restored');
    assert.equal(mockDb.products[3].stock, oilBefore + 2, 'Oil physical stock restored');
    assert.equal(inventory.getSellableStock(mockDb.products[1]), 3);
  });

  t.test('Cannot cancel an already cancelled order', function () {
    var mockDb = {
      orders: [{ id: 1007, status: 'cancelled', items: [] }]
    };
    var cancelRes = orders.cancel(mockDb, 1007);
    assert.equal(cancelRes.ok, false);
    assert.match(cancelRes.error, /already cancelled/);
  });
});
