const test = require('node:test');
const assert = require('node:assert/strict');

const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

test('a sale may consume exactly all currently sellable stock', () => {
  const products = [{ id: 1, name: 'Ghee', stock: 1, reserved: 0 }];

  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 1 }]), { ok: true });
});
test('a sale larger than currently sellable stock is rejected', () => {
  const products = [{ id: 1, name: 'Ghee', stock: 1, reserved: 0 }];

  assert.equal(inventory.check(products, [{ id: 1, qty: 2 }]).ok, false);
});

test('cancelling an order restores physical stock without changing wholesale reservations', () => {
  const db = {
    products: [{ id: 1, name: 'Rice', stock: 2, reserved: 1 }],
    orders: [{
      id: 77,
      status: 'pending',
      paymentMode: 'cash',
      items: [{ id: 1, qty: 2 }]
    }]
  };

  const result = orders.cancel(db, 77, 'Cancelled in test');

  assert.equal(result.ok, true);
  assert.equal(db.products[0].stock, 4);
  assert.equal(db.products[0].reserved, 1);
});

