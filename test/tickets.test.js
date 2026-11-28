const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');
const dates = require('../lib/dates');
const ledger = require('../lib/ledger');
const reports = require('../lib/reports');

test('invoice and GST audit agree with the billed SAVE10 order', () => {
  const order = {
    id: 1002, coupon: 'SAVE10', subtotal: 1020, discount: 102, tax: 45.9, total: 963.9,
    items: [{ hsn: '1006', price: 640, qty: 1 }, { hsn: '1512', price: 190, qty: 2 }]
  };
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 28.8], [5, 17.1]]);
  assert.equal(figures.total, 963.9);
  assert.equal(figures.tax, 45.9);
  assert.equal(figures.cgst + figures.sgst, figures.tax);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 0);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice:/);
});

test('invoice applies the coupon cap and calculates GST after the discount', () => {
  const figures = invoice.computeInvoiceFigures({
    coupon: 'SAVE10', items: [{ hsn: '1508', price: 1120, qty: 2 }]
  });
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 104.5);
  assert.equal(figures.total, 2194.5);
});

test('invoice resolves mixed HSN slabs without a coupon', () => {
  const figures = invoice.computeInvoiceFigures({
    items: [{ hsn: '0405', price: 450, qty: 2 }, { hsn: '1512', price: 190, qty: 2 }]
  });
  assert.deepEqual(figures.rows.map(row => row.gstPercent), [12, 5]);
  assert.equal(figures.tax, 127);
  assert.equal(figures.total, 1407);
});

test('orders can buy exactly the sellable stock without using reserved units', () => {
  const products = [{ id: 6, stock: 1 }, { id: 11, stock: 4, reserved: 3 }];
  assert.equal(inventory.check(products, [{ id: 11, qty: 2 }]).ok, false);
  assert.equal(inventory.check(products, [{ id: 11, qty: 1 }, { id: 11, qty: 1 }]).ok, false);
  const items = [{ id: 6, qty: 1 }, { id: 11, qty: 1 }];
  assert.equal(inventory.check(products, items).ok, true);
  inventory.reserve(products, items);
  assert.deepEqual(products.map(product => product.stock), [0, 3]);
  assert.equal(products[1].reserved, 3);
});

test('cancelling an order restores physical stock exactly once', () => {
  const product = { id: 6, stock: 4, reserved: 3 };
  const order = { id: 1007, status: 'pending', items: [{ id: 6, qty: 2 }] };
  const db = { products: [product], orders: [order] };
  assert.equal(orders.cancel(db, 1007).ok, true);
  assert.equal(order.status, 'cancelled');
  assert.equal(orders.cancel(db, 1007).ok, false);
  assert.deepEqual(product, { id: 6, stock: 6, reserved: 3 });
});

const orderHistory = {
  orders: [
    { id: 1001, date: '28/12/2021' },
    { id: 1002, date: '05/01/2022' },
    { id: 1004, date: '30/01/2022' },
    { id: 1008, date: '15/03/2022' }
  ]
};

test('order history sorts newest first across months and years', () => {
  assert.deepEqual(orders.list(orderHistory).map(order => order.id), [1008, 1004, 1002, 1001]);
});

test('order history uses inclusive date bounds in either supported format', () => {
  const result = orders.list(orderHistory, { from: '2022-01-05', to: '30/01/2022' });
  assert.deepEqual(result.map(order => order.id), [1004, 1002]);
  assert.equal(dates.getFiscalYear('2022-01-05'), 'FY21-22');
  assert.equal(dates.getFiscalYear('05/04/2022'), 'FY22-23');
});

test('Khata adds a string payment numerically and records the new balance', () => {
  const customer = { id: 1, openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200 };
  const db = { customers: [customer], nextSettlementId: 1 };
  const result = ledger.recordSettlement(db, 1, '500');
  assert.equal(result.ok, true);
  assert.equal(customer.totalSettled, 1700);
  assert.equal(customer.balance, 732.01);
  assert.equal(db.settlements[0].amount, 500);
});

test('Khata rejects a nonnumeric payment without changing the ledger', () => {
  const customer = { id: 1, totalSettled: 1200 };
  const db = { customers: [customer], nextSettlementId: 1 };
  assert.equal(ledger.recordSettlement(db, 1, 'invalid').ok, false);
  assert.deepEqual(db, { customers: [{ id: 1, totalSettled: 1200 }], nextSettlementId: 1 });
});
