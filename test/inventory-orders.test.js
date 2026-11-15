const test = require('node:test');
const assert = require('node:assert/strict');

const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

test('Current Behaviour: selling fewer than all sellable units is allowed', () => {
  const products = [
    { id: 6, name: 'A2 Gir Cow Ghee 500ml', stock: 2, reserved: 0 }
  ];

  assert.deepEqual(
    inventory.check(products, [{ id: 6, qty: 1 }]),
    { ok: true }
  );
});

test('Current Behaviour: selling the last sellable unit is allowed', () => {
  const products = [
    { id: 6, name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 }
  ];

  assert.deepEqual(inventory.check(products, [{ id: 6, qty: 1 }]), { ok: true });
});

test('Current Behaviour: selling all remaining sellable units is allowed after reservations', () => {
  const products = [
    { id: 11, name: 'Byadgi Kashmiri Chilli Powder 500g', stock: 4, reserved: 3 }
  ];

  assert.deepEqual(inventory.check(products, [{ id: 11, qty: 1 }]), { ok: true });
});

test('Current Behaviour: cancelling an order changes status and restores physical stock', () => {
  const db = {
    orders: [
      {
        id: 1007,
        status: 'pending',
        paymentMode: 'cash',
        items: [{ id: 6, qty: 2 }],
        total: 900
      }
    ],
    products: [
      { id: 6, name: 'A2 Gir Cow Ghee 500ml', stock: 3, reserved: 0 }
    ]
  };

  inventory.reserve(db.products, db.orders[0].items);
  assert.equal(db.products[0].stock, 1);

  const result = orders.cancel(db, 1007, 'Customer changed their mind');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(result.order.cancelReason, 'Customer changed their mind');
  assert.equal(db.products[0].stock, 3);
  assert.equal(db.products[0].reserved, 0);
});
