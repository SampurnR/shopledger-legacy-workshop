const assert = require('node:assert/strict');
const { test } = require('node:test');
const dates = require('../lib/dates');
const inventory = require('../lib/inventory');
const ledger = require('../lib/ledger');
const orders = require('../lib/orders');

test('Inventory checks the exact sellable quantity with and without reservations', () => {
  const products = [
    { id: 1, name: 'Ghee', stock: 1, reserved: 0 },
    { id: 2, name: 'Chilli', stock: 4, reserved: 3 }
  ];
  const items = [{ id: 1, qty: 1 }, { id: 2, qty: 1 }];

  assert.equal(inventory.check(products, items).ok, true);
  assert.equal(inventory.check(products, [{ id: 2, qty: 2 }]).ok, false);
  assert.equal(inventory.check(products, [{ id: 2, qty: 1 }, { id: '2', qty: 1 }]).ok, false);
});

test('Cancelling a pending order handles current and legacy item IDs', () => {
  const products = [
    { id: 1, stock: 4, reserved: 3 },
    { id: 2, stock: 5, reserved: 2 }
  ];
  const items = [{ id: 1, qty: 2 }, { productId: 2, qty: 1 }];
  const order = { id: 1007, status: 'pending', items };
  const db = { products, orders: [order] };

  assert.equal(orders.cancel(db, 1007).ok, true);
  assert.equal(order.status, 'cancelled');
  assert.deepEqual(products.map(({ stock, reserved }) => [stock, reserved]), [[6, 3], [6, 2]]);
  assert.equal(orders.cancel(db, 1007).ok, false);
  assert.deepEqual(products.map(({ stock, reserved }) => [stock, reserved]), [[6, 3], [6, 2]]);
});

test('Order history sorts and filters dates across months and years', () => {
  const db = { orders: [
    { id: 1004, date: '30/01/2022' },
    { id: 1001, date: '28/12/2021' },
    { id: 1008, date: '15/03/2022' },
    { id: 1007, date: '04/03/2022' },
    { id: 1002, date: '2022-01-01' }
  ] };

  assert.deepEqual(orders.list(db).map(({ id }) => id), [1008, 1007, 1004, 1002, 1001]);
  assert.deepEqual(
    orders.list(db, { from: '2022-01-01', to: '2022-01-31' }).map(({ id }) => id),
    [1004, 1002]
  );
  assert.equal(dates.getFiscalYear('31/03/2022'), 'FY21-22');
  assert.equal(dates.getFiscalYear('2022-04-01'), 'FY22-23');
});

test('Khata records a settlement amount submitted as text', () => {
  const customer = { id: 1, openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200 };
  const db = { customers: [customer], nextSettlementId: 501 };
  const result = ledger.recordSettlement(db, 1, '500');

  assert.equal(result.ok, true);
  assert.equal(result.settlement.amount, 500);
  assert.equal(customer.totalSettled, 1700);
  assert.equal(customer.balance, 732.01);
});

test('Invalid Khata settlement amounts leave the account and settlement sequence intact', () => {
  const customer = { id: 1, totalSettled: 1200 };
  const db = { customers: [customer], nextSettlementId: 501, settlements: [] };

  for (const amount of ['invalid', '', -1, Infinity, true]) {
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false);
  }
  assert.equal(customer.totalSettled, 1200);
  assert.equal(db.nextSettlementId, 501);
  assert.deepEqual(db.settlements, []);
});
