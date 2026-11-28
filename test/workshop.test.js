const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');
const ledger = require('../lib/ledger');

test('invoice with SAVE10 and 5% HSN', () => {
  const result = invoice.computeInvoiceFigures({items: [{price: 1020, qty: 1, hsn: '1006'}], coupon: 'SAVE10'});
  assert.deepEqual([result.tax, result.total], [45.90, 963.90]);
});

test('last sellable unit', () => {
  const products = [{id: 1, stock: 4, reserved: 3}];
  assert.equal(inventory.check(products, [{id: 1, qty: 1}]).ok, true);
  assert.equal(inventory.check(products, [{id: 1, qty: 2}]).ok, false);
});

test('cancellation restores physical stock once', () => {
  const db = {products: [{id: 1, stock: 3, reserved: 2}], orders: [{id: 7, items: [{id: 1, qty: 2}]}]};
  assert.ok(orders.cancel(db, 7).ok);
  assert.equal(orders.cancel(db, 7).ok, false);
  assert.deepEqual(db.products[0], {id: 1, stock: 5, reserved: 2});
});

test('history across years and inclusive range', () => {
  const db = {orders: [{id: 1, date: '28/12/2021'}, {id: 2, date: '15/03/2022'}]};
  assert.deepEqual(orders.list(db).map(o => o.id), [2, 1]);
  assert.deepEqual(orders.list(db, {from: '2022-03-15', to: '2022-03-31'}).map(o => o.id), [2]);
});

test('settlement from the UI', () => {
  const customer = {id: 1, totalBilled: 2432.01, totalSettled: 1200};
  const db = {customers: [customer], nextSettlementId: 1};
  assert.ok(ledger.recordSettlement(db, 1, '500').ok);
  assert.deepEqual([customer.totalSettled, customer.balance], [1700, 732.01]);
});
