'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const inventory = require('../lib/inventory');
const orders = require('../lib/orders');
const ledger = require('../lib/ledger');

test('a sale may consume exactly the remaining sellable stock, including reserved stock', () => {
  const products = [
    { id: 1, name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 },
    { id: 2, name: 'Byadgi Chilli Powder 500g', stock: 4, reserved: 3 }
  ];

  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 1 }]), { ok: true });
  assert.deepEqual(inventory.check(products, [{ id: 2, qty: 1 }]), { ok: true });
});

test('cancelling a pending order restores physical stock once', () => {
  const db = {
    products: [{ id: 7, name: 'Test SKU', stock: 3, reserved: 3 }],
    orders: [{
      id: 1007,
      status: 'pending',
      items: [{ id: 7, qty: 1 }],
      paymentMode: 'cash',
      total: 0
    }],
    customers: []
  };

  assert.equal(orders.cancel(db, 1007, 'test cancellation').ok, true);
  assert.equal(db.products[0].stock, 4);
  assert.equal(inventory.getSellableStock(db.products[0]), 1);

  assert.equal(orders.cancel(db, 1007).ok, false);
  assert.equal(db.products[0].stock, 4);
});

test('releasing a quote hold reduces reserved stock without changing physical stock', () => {
  const products = [{ id: 7, name: 'Test SKU', stock: 10, reserved: 3 }];

  inventory.release(products, [{ productId: 7, qty: 1 }]);

  assert.equal(products[0].stock, 10);
  assert.equal(products[0].reserved, 2);
});

test('order history sorts chronologically and filters inclusive date ranges', () => {
  const db = {
    orders: [
      { id: 1004, date: '30/01/2022' },
      { id: 1001, date: '28/12/2021' },
      { id: 1008, date: '15/03/2022' }
    ]
  };

  assert.deepEqual(orders.list(db, {}).map(order => order.id), [1008, 1004, 1001]);
  assert.deepEqual(
    orders.list(db, { from: '2022-01-01', to: '2022-02-28' }).map(order => order.id),
    [1004]
  );
});

test('Khata settlement converts a string amount to a number before adding it', () => {
  const db = {
    customers: [{
      id: 1,
      name: 'Meera Joshi',
      openingBalance: 0,
      totalBilled: 2432.01,
      totalSettled: 1200,
      creditLimit: 5000
    }],
    settlements: [],
    nextSettlementId: 501
  };

  const result = ledger.recordSettlement(db, 1, '500', 'upi', 'counter payment');

  assert.equal(result.ok, true);
  assert.equal(result.settlement.amount, 500);
  assert.equal(typeof result.customer.totalSettled, 'number');
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
});
