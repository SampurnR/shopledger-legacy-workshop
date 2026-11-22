const test = require('node:test');
const assert = require('node:assert/strict');

const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

test('a sale may consume the exact final sellable unit, including stock held above reservations', () => {
  const products = [{ id: 1, name: 'Ghee', stock: 1, reserved: 0 }];
  const chilli = { id: 2, name: 'Chilli powder', stock: 4, reserved: 3 };
  products.push(chilli);

  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 1 }]), { ok: true });
  assert.deepEqual(inventory.check(products, [{ id: 2, qty: 1 }]), { ok: true });
});
test('a sale larger than currently sellable stock is rejected, including duplicate product lines', () => {
  const products = [{ id: 1, name: 'Ghee', stock: 1, reserved: 0 }];

  assert.equal(inventory.check(products, [{ id: 1, qty: 2 }]).ok, false);
  assert.equal(inventory.check(products, [{ id: 1, qty: 1 }, { id: 1, qty: 1 }]).ok, false);
});

test('cancelling an order restores each item once without changing wholesale reservations', () => {
  const db = {
    products: [
      { id: 1, name: 'Rice', stock: 2, reserved: 1 },
      { id: 2, name: 'Chilli powder', stock: 3, reserved: 3 }
    ],
    orders: [{
      id: 77,
      status: 'pending',
      paymentMode: 'cash',
      items: [{ id: 1, qty: 2 }, { id: 2, qty: 1 }]
    }]
  };

  const result = orders.cancel(db, 77, 'Cancelled in test');

  assert.equal(result.ok, true);
  assert.equal(db.products[0].stock, 4);
  assert.equal(db.products[0].reserved, 1);
  assert.equal(db.products[1].stock, 4);
  assert.equal(db.products[1].reserved, 3);

  const duplicateResult = orders.cancel(db, 77, 'Repeated cancel');
  assert.equal(duplicateResult.ok, false);
  assert.equal(db.products[0].stock, 4);
  assert.equal(db.products[1].stock, 4);
});

