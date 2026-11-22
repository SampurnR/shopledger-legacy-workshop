var test = require('node:test');
var assert = require('node:assert/strict');

var inventory = require('../lib/inventory');

function mockProducts() {
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
      name: 'Byadgi Chilli Powder 200g',
      price: 110,
      stock: 4,
      reserved: 3
    }
  ];
}

test('getSellableStock returns physical stock minus wholesale reserved units', function () {
  var products = mockProducts();
  assert.equal(inventory.getSellableStock(products[0]), 1); // 1 - 0 = 1
  assert.equal(inventory.getSellableStock(products[1]), 1); // 4 - 3 = 1
});

test('check allows buying the exact remaining sellable stock (qty === sellable)', function () {
  var products = mockProducts();

  // Buy 1 of Ghee (sellable: 1)
  var res1 = inventory.check(products, [{ id: 6, qty: 1 }]);
  assert.equal(res1.ok, true);

  // Buy 1 of Byadgi Chilli (sellable: 1, stock: 4, reserved: 3)
  var res2 = inventory.check(products, [{ id: 11, qty: 1 }]);
  assert.equal(res2.ok, true);
});

test('check rejects purchase when requested qty exceeds sellable stock', function () {
  var products = mockProducts();

  // Attempt to buy 2 of Ghee when only 1 sellable is available
  var res = inventory.check(products, [{ id: 6, qty: 2 }]);
  assert.equal(res.ok, false);
  assert.match(res.msg, /A2 Gir Cow Ghee 500ml is out of stock \(1 sellable available\)/);
});

test('reserve deducts committed quantities from physical stock', function () {
  var products = mockProducts();
  inventory.reserve(products, [{ id: 6, qty: 1 }, { id: 11, qty: 1 }]);

  assert.equal(products[0].stock, 0);
  assert.equal(products[1].stock, 3);
});

test('release restores items back to physical stock upon order cancellation', function () {
  var products = mockProducts();
  // Simulate order placed (stock deducted)
  inventory.reserve(products, [{ id: 6, qty: 1 }]);
  assert.equal(products[0].stock, 0);

  // Simulate order cancelled (items released back to stock)
  inventory.release(products, [{ id: 6, qty: 1 }]);
  assert.equal(products[0].stock, 1);
});

test('release handles both item.id and item.productId formats', function () {
  var products = mockProducts();
  inventory.reserve(products, [{ id: 11, qty: 1 }]);
  assert.equal(products[1].stock, 3);

  // Using item.productId (backward compatibility)
  inventory.release(products, [{ productId: 11, qty: 1 }]);
  assert.equal(products[1].stock, 4);
});
