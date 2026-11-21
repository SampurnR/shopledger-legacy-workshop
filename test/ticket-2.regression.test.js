const assert = require('node:assert/strict');
const { test } = require('node:test');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

test('Ticket 2: accepts a sale of the last sellable unit', () => {
  const product = { id: 6, name: 'Ghee', stock: 1, reserved: 0 };
  const items = [{ id: 6, qty: 1 }];
  const result = inventory.check([product], items);

  assert.equal(result.ok, true, result.msg);
  inventory.reserve([product], items);
  assert.equal(product.stock, 0);
});

test('Ticket 2: cancelling a pending order restores each purchased quantity', () => {
  const db = {
    products: [
      { id: 6, stock: 1, reserved: 0 },
      { id: 4, stock: 7, reserved: 2 }
    ],
    orders: [{
      id: 1007,
      status: 'pending',
      paymentMode: 'cash',
      items: [{ id: 6, qty: 2 }, { id: 4, qty: 2 }]
    }]
  };

  const result = orders.cancel(db, 1007);

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.deepEqual(db.products, [
    { id: 6, stock: 3, reserved: 0 },
    { id: 4, stock: 9, reserved: 2 }
  ]);
});


test('Ticket 2: repeated cart lines cannot consume wholesale-held stock', () => {
  const product = { id: 11, name: 'Chilli powder', stock: 6, reserved: 3 };
  const items = [{ id: 11, qty: 2 }, { id: 11, qty: 2 }];

  assert.equal(inventory.check([product], items).ok, false);
});
