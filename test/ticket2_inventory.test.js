var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

function createProductsFixture() {
  return [
    { id: 1, name: 'Indrayani Basmati Rice 5kg', stock: 18, reserved: 2 },
    { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', stock: 22, reserved: 4 },
    { id: 6, name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 },
    { id: 7, name: 'Byadgi Kashmiri Chilli Powder 500g', stock: 4, reserved: 3 },
    { id: 11, name: 'Organic Turmeric Powder 250g', stock: 4, reserved: 3 },
    { id: 12, name: 'Out of Stock Item', stock: 2, reserved: 5 }
  ];
}

function createOrderDbFixture() {
  return {
    nextOrderId: 1008,
    products: createProductsFixture(),
    customers: [
      {
        id: 4,
        name: 'Suresh Deshmukh',
        creditLimit: 5000,
        openingBalance: 100,
        totalBilled: 1407,
        totalSettled: 200,
        balance: 1307
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
          { id: 6, name: 'A2 Gir Cow Ghee 500ml', qty: 2 },
          { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', qty: 2 }
        ],
        total: 1407
      }
    ]
  };
}

test('Ticket 2 (#2 / #435) Inventory & Order Cancellation', function (t) {
  t.test('getSellableStock computes physical minus reserved and clamps at 0', function () {
    var products = createProductsFixture();
    assert.equal(inventory.getSellableStock(products[0]), 16);
    assert.equal(inventory.getSellableStock(products[2]), 1);
    assert.equal(inventory.getSellableStock(products[3]), 1);
    assert.equal(inventory.getSellableStock(products[5]), 0);
    assert.equal(inventory.getSellableStock(null), 0);
  });

  t.test('check allows selling exact last sellable unit (with and without reserved)', function () {
    var products = createProductsFixture();
    assert.deepEqual(inventory.check(products, [{ id: 6, qty: 1 }]), { ok: true });
    assert.deepEqual(inventory.check(products, [{ id: 11, qty: 1 }]), { ok: true });
    assert.deepEqual(inventory.check(products, [{ id: 1, qty: 16 }]), { ok: true });
  });

  t.test('check rejects exceeding sellable stock and unknown product', function () {
    var products = createProductsFixture();
    var over = inventory.check(products, [{ id: 6, qty: 2 }]);
    assert.equal(over.ok, false);
    assert.equal(over.msg, 'A2 Gir Cow Ghee 500ml is out of stock (1 sellable available)');

    var zero = inventory.check(products, [{ id: 12, qty: 1 }]);
    assert.equal(zero.ok, false);
    assert.equal(zero.msg, 'Out of Stock Item is out of stock (0 sellable available)');

    var unknown = inventory.check(products, [{ id: 999, qty: 1 }]);
    assert.equal(unknown.ok, false);
    assert.equal(unknown.msg, 'Unknown product 999');
  });

  t.test('check aggregates duplicate product IDs in items array and preserves order', function () {
    var products = createProductsFixture();

    var dupFail = inventory.check(products, [{ id: 6, qty: 1 }, { id: 6, qty: 1 }]);
    assert.equal(dupFail.ok, false);
    assert.equal(dupFail.msg, 'A2 Gir Cow Ghee 500ml is out of stock (1 sellable available)');

    var mixedTypeDupFail = inventory.check(products, [{ id: 6, qty: 1 }, { id: '6', qty: 1 }]);
    assert.equal(mixedTypeDupFail.ok, false);
    assert.equal(mixedTypeDupFail.msg, 'A2 Gir Cow Ghee 500ml is out of stock (1 sellable available)');

    var productIdDupFail = inventory.check(products, [{ id: 11, qty: 1 }, { productId: 11, qty: 1 }]);
    assert.equal(productIdDupFail.ok, false);
    assert.equal(productIdDupFail.msg, 'Organic Turmeric Powder 250g is out of stock (1 sellable available)');

    var dupPass = inventory.check(products, [{ id: 1, qty: 10 }, { id: 1, qty: 6 }]);
    assert.deepEqual(dupPass, { ok: true });

    var orderedFail = inventory.check(products, [{ id: 7, qty: 2 }, { id: 6, qty: 2 }]);
    assert.equal(orderedFail.ok, false);
    assert.equal(orderedFail.msg, 'Byadgi Kashmiri Chilli Powder 500g is out of stock (1 sellable available)');
  });

  t.test('check rejects falsy items and invalid/non-positive/NaN quantities', function () {
    var products = createProductsFixture();

    assert.deepEqual(inventory.check(products, null), { ok: true });
    assert.deepEqual(inventory.check(products, []), { ok: true });

    var falsyItem = inventory.check(products, [null]);
    assert.equal(falsyItem.ok, false);
    assert.equal(falsyItem.msg, 'Invalid order item');

    var invalidValues = [0, -1, NaN, 'abc', null, undefined, true, Infinity];
    for (var i = 0; i < invalidValues.length; i++) {
      var res = inventory.check(products, [{ id: 6, qty: invalidValues[i] }]);
      assert.equal(res.ok, false);
      assert.equal(res.msg, 'Invalid quantity for A2 Gir Cow Ghee 500ml');
    }
  });

  t.test('reserve deducts physical stock with id/productId and guards invalid qty', function () {
    var products = createProductsFixture();
    inventory.reserve(products, [
      { id: 1, qty: 3 },
      { productId: 4, qty: 2 },
      { id: 6, qty: 0 },
      { id: 6, qty: -2 },
      { id: 6, qty: NaN },
      null
    ]);
    assert.equal(products[0].stock, 15);
    assert.equal(products[0].reserved, 2);
    assert.equal(products[1].stock, 20);
    assert.equal(products[1].reserved, 4);
    assert.equal(products[2].stock, 1);
  });

  t.test('release restores physical stock for id and productId without changing reserved', function () {
    var products = createProductsFixture();
    inventory.release(products, [
      { id: 4, qty: 2 },
      { productId: 11, qty: 1 },
      { id: 6, qty: 0 },
      { id: 6, qty: -1 },
      { id: 6, qty: NaN },
      null
    ]);
    assert.equal(products[1].stock, 24);
    assert.equal(products[1].reserved, 4);
    assert.equal(inventory.getSellableStock(products[1]), 20);
    assert.equal(products[4].stock, 5);
    assert.equal(products[4].reserved, 3);
    assert.equal(products[2].stock, 1);
  });

  t.test('orders.cancel restores all items, reverses khata debit, and blocks double-cancel', function () {
    var db = createOrderDbFixture();
    db.orders[0].paymentMode = 'Khata';
    var res = orders.cancel(db, 1007, 'Customer cancelled');
    assert.equal(res.ok, true);
    assert.equal(res.order.status, 'cancelled');
    assert.equal(typeof res.order.cancelledAt, 'string');
    assert.equal(res.order.cancelReason, 'Customer cancelled');

    assert.equal(db.products[2].stock, 3);
    assert.equal(db.products[1].stock, 24);
    assert.equal(db.products[1].reserved, 4);
    assert.equal(inventory.getSellableStock(db.products[1]), 20);
    assert.equal(db.customers[0].totalBilled, 0);
    assert.equal(db.customers[0].balance, -100);

    var second = orders.cancel(db, 1007, 'Retry');
    assert.equal(second.ok, false);
    assert.equal(second.error, 'Order #1007 is already cancelled');
    assert.equal(db.products[2].stock, 3);
    assert.equal(db.products[1].stock, 24);
    assert.equal(db.customers[0].totalBilled, 0);

    var missing = orders.cancel(db, 9999);
    assert.equal(missing.ok, false);
    assert.equal(missing.error, 'Order not found');
  });
});
