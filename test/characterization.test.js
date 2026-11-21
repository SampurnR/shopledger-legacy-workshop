const test = require('node:test');
const assert = require('node:assert/strict');

const inventory = require('../lib/inventory');
const invoice = require('../lib/invoice');
const ledger = require('../lib/ledger');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');

test('invoice uses the checkout calculation for a 5% HSN SAVE10 order', function () {
  const order = {
    coupon: 'SAVE10',
    items: [
      { id: 1, name: 'Rice', sku: 'RIC-001', hsn: '1006', price: 1020, qty: 1 }
    ]
  };

  const checkout = pricing.computeTotals(order.items, order.coupon);
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: checkout.discount, tax: checkout.tax, total: checkout.total },
    { discount: 102, tax: 45.9, total: 963.9 }
  );
  assert.deepEqual(
    { discount: printed.discount, tax: printed.tax, total: printed.total },
    { discount: 102, tax: 45.9, total: 963.9 }
  );
});

test('inventory accepts buying the exact sellable quantity', function () {
  const products = [{ id: 1, name: 'Ghee', stock: 1, reserved: 0 }];

  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 1 }]), { ok: true });
});

test('inventory checks repeated lines in aggregate', function () {
  const products = [{ id: 1, name: 'Ghee', stock: 2, reserved: 0 }];

  assert.deepEqual(
    inventory.check(products, [{ id: 1, qty: 2 }, { id: 1, qty: 2 }]),
    { ok: false, msg: 'Ghee is out of stock (2 sellable available)' }
  );
  assert.deepEqual(
    inventory.check(products, [{ id: 1, qty: 1 }, { id: 1, qty: 1 }]),
    { ok: true }
  );
});

test('cancelling an order restores its physical stock', function () {
  const db = {
    products: [{ id: 1, name: 'Ghee', stock: 8, reserved: 0 }],
    orders: [{
      id: 1007,
      status: 'pending',
      paymentMode: 'cash',
      items: [{ id: 1, qty: 2 }],
      total: 100
    }]
  };

  const result = orders.cancel(db, 1007, 'Customer request');

  assert.equal(result.ok, true);
  assert.equal(db.products[0].stock, 10);
  assert.equal(db.orders[0].status, 'cancelled');
});

test('order history sorts and filters DD/MM/YYYY dates chronologically', function () {
  const db = {
    orders: [
      { id: 1004, date: '30/01/2022' },
      { id: 1008, date: '15/03/2022' },
      { id: 1001, date: '28/12/2021' }
    ]
  };

  assert.deepEqual(
    orders.list(db, {}).map(function (order) { return order.id; }),
    [1008, 1004, 1001]
  );
  assert.deepEqual(
    orders.list(db, { from: '2022-01-01', to: '2022-01-31' }).map(function (order) { return order.id; }),
    [1004]
  );
});

test('a numeric string Khata settlement updates totals numerically', function () {
  const db = {
    nextSettlementId: 505,
    settlements: [],
    customers: [{
      id: 1,
      name: 'Meera Joshi',
      openingBalance: 450,
      totalBilled: 1982.01,
      totalSettled: 1200
    }]
  };

  const result = ledger.recordSettlement(db, 1, '500', 'cash', 'Counter payment');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});
