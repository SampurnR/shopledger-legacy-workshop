const test = require('node:test');
const assert = require('node:assert/strict');

const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

test('CURRENT BEHAVIOUR: exact last physical unit is rejected as out of stock', () => {
  const products = [
    { id: 6, name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 }
  ];

  assert.deepEqual(inventory.check(products, [{ id: 6, qty: 1 }]), {
    ok: false,
    msg: 'A2 Gir Cow Ghee 500ml is out of stock (1 sellable available)'
  });
});

test('CURRENT BEHAVIOUR: exact last sellable unit is rejected when other stock is reserved', () => {
  const products = [
    { id: 11, name: 'Byadgi Kashmiri Chilli Powder 500g', stock: 4, reserved: 3 }
  ];

  assert.deepEqual(inventory.check(products, [{ id: 11, qty: 1 }]), {
    ok: false,
    msg: 'Byadgi Kashmiri Chilli Powder 500g is out of stock (1 sellable available)'
  });
});

test('CURRENT BEHAVIOUR: cancelling Pending Order 1007 does not restore deducted stock', () => {
  const db = {
    products: [
      { id: 6, name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 },
      { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', stock: 22, reserved: 4 }
    ],
    customers: [
      { id: 4, name: 'Test customer', openingBalance: 0, totalBilled: 1407, totalSettled: 0 }
    ],
    orders: [
      {
        id: 1007,
        customerId: 4,
        paymentMode: 'khata',
        status: 'pending',
        total: 1407,
        items: [
          { id: 6, qty: 2 },
          { id: 4, qty: 2 }
        ]
      }
    ]
  };

  const result = orders.cancel(db, 1007, 'Characterization test');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(db.products[0].stock, 1);
  assert.equal(db.products[1].stock, 22);
  assert.equal(db.customers[0].totalBilled, 0);
});

test('reserve deducts committed quantities from physical stock', () => {
  const products = [{ id: 6, name: 'Ghee', stock: 3, reserved: 0 }];

  inventory.reserve(products, [{ id: 6, qty: 2 }]);

  assert.equal(products[0].stock, 1);
  assert.equal(products[0].reserved, 0);
});

test('a cancelled order cannot release inventory twice', () => {
  const db = {
    products: [{ id: 6, name: 'Ghee', stock: 1, reserved: 0 }],
    customers: [],
    orders: [{ id: 1007, status: 'cancelled', paymentMode: 'cash', items: [{ id: 6, qty: 2 }] }]
  };

  assert.deepEqual(orders.cancel(db, 1007), {
    ok: false,
    error: 'Order #1007 is already cancelled'
  });
  assert.equal(db.products[0].stock, 1);
});
