const assert = require('node:assert/strict');
const test = require('node:test');

const inventory = require('../lib/inventory');
const ledger = require('../lib/ledger');
const orders = require('../lib/orders');

function orderHistory() {
  return { orders: [
    { id: 1001, date: '28/12/2021' },
    { id: 1004, date: '30/01/2022' },
    { id: 1007, date: '04/03/2022' },
    { id: 1008, date: '15/03/2022' }
  ] };
}

function khataAccount(totalSettled = 1200) {
  return {
    customers: [{ id: 1, name: 'Meera Joshi', openingBalance: 450, totalBilled: 1982.01, totalSettled }],
    settlements: [],
    nextSettlementId: 501
  };
}

test('order history sorts newest first across months and years', () => {
  const db = orderHistory();
  assert.deepEqual(orders.list(db).map((order) => order.id), [1008, 1007, 1004, 1001]);
  assert.deepEqual(db.orders.map((order) => order.id), [1001, 1004, 1007, 1008]);
});

test('order history filters inclusively with date-picker and stored date formats', () => {
  const db = orderHistory();
  for (const [from, to] of [['2022-01-01', '2022-01-31'], ['01/01/2022', '31/01/2022']]) {
    assert.deepEqual(orders.list(db, { from, to }).map((order) => order.id), [1004]);
  }
  assert.deepEqual(orders.list(db, { from: '2022-01-30', to: '2022-01-30' }).map((order) => order.id), [1004]);
  assert.deepEqual(orders.list(db, { from: '2022-01-30' }).map((order) => order.id), [1008, 1007, 1004]);
  assert.deepEqual(orders.list(db, { to: '2022-01-30' }).map((order) => order.id), [1004, 1001]);
});

test('a string settlement amount updates the numeric cumulative total and balance', () => {
  const db = khataAccount();
  assert.equal(ledger.listCustomers(db)[0].balance, 1232.01);

  const result = ledger.recordSettlement(db, '1', '500');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(ledger.listCustomers(db)[0].balance, 732.01);
  assert.equal(db.settlements[0].amount, 500);
});

test('a fractional settlement adds numerically to an existing string total', () => {
  const db = khataAccount('1200.10');
  const result = ledger.recordSettlement(db, 1, 0.2);

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1200.3);
  assert.equal(result.settlement.amount, 0.2);
});

test('invalid settlement amounts leave the account and receipts untouched', () => {
  const db = khataAccount();
  for (const amount of ['', '0', '-1', 'invalid', Infinity, true, [500]]) {
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false);
    assert.deepEqual(db, khataAccount());
  }
});

test('checkout can sell the last sellable unit while keeping wholesale holds', () => {
  const products = [
    { id: 1, name: 'Ghee', stock: 1, reserved: 0 },
    { id: 2, name: 'Chilli powder', stock: 4, reserved: 3 }
  ];
  const items = [{ id: 1, qty: 1 }, { id: 2, qty: 1 }];

  assert.equal(inventory.check(products, items).ok, true);
  inventory.reserve(products, items);

  assert.deepEqual(products.map(({ stock, reserved }) => [stock, reserved]), [[0, 0], [3, 3]]);
  assert.equal(inventory.check(products, items).ok, false);
});

test('stock check counts duplicate product lines against the same sellable quantity', () => {
  const products = [{ id: 1, name: 'Ghee', stock: 4, reserved: 1 }];
  const first = { id: 1, qty: 2 };

  assert.equal(inventory.check(products, [first, { id: '1', qty: 1 }]).ok, true);
  assert.equal(inventory.check(products, [first, { id: '1', qty: 2 }]).ok, false);
});

test('cancellation restores physical stock once and preserves wholesale holds', () => {
  const db = {
    products: [
      { id: 1, stock: 1, reserved: 1 },
      { id: 2, stock: 4, reserved: 0 }
    ],
    orders: [{ id: 1007, status: 'pending', items: [{ id: 1, qty: 2 }, { id: 2, qty: 2 }] }]
  };

  assert.equal(orders.cancel(db, 1007).ok, true);
  assert.equal(db.orders[0].status, 'cancelled');
  assert.deepEqual(db.products.map(({ stock, reserved }) => [stock, reserved]), [[3, 1], [6, 0]]);
  assert.deepEqual(db.products.map(inventory.getSellableStock), [2, 6]);

  assert.equal(orders.cancel(db, 1007).ok, false);
  assert.deepEqual(db.products.map(({ stock }) => stock), [3, 6]);
});

test('cancellation also restores stock for a stored productId line', () => {
  const db = {
    products: [{ id: 1, stock: 1, reserved: 1 }],
    orders: [{ id: 1007, status: 'pending', items: [{ productId: 1, qty: 2 }] }]
  };

  assert.equal(orders.cancel(db, 1007).ok, true);
  assert.deepEqual(db.products[0], { id: 1, stock: 3, reserved: 1 });
});
