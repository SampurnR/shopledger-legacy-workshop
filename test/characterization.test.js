const { test } = require('node:test');
const assert = require('node:assert/strict');

const inventory = require('../lib/inventory');
const ledger = require('../lib/ledger');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function fixture() {
  return {
    nextOrderId: 1001,
    products: [
      { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 100, stock: 5, reserved: 1 },
      { id: 2, sku: 'TEA', name: 'Tea', hsn: '0902', price: 100, stock: 10, reserved: 0 }
    ],
    orders: [],
    customers: [{
      id: 7, name: 'Asha', creditLimit: 500, openingBalance: 100,
      totalBilled: 50, totalSettled: 25
    }],
    settlements: [],
    auditLog: []
  };
}

test('pricing uses configured HSN slabs and applies coupon discount before GST', () => {
  const totals = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }
  ], 'WELCOME');

  assert.deepEqual({
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  }, { subtotal: 200, discount: 10, tax: 9.5, total: 199.5 });
});

test('inventory sellable quantity subtracts reserved units and rejects an exact-stock order', () => {
  const db = fixture();
  assert.equal(inventory.getSellableStock(db.products[0]), 4);
  assert.deepEqual(inventory.check(db.products, [{ id: 1, qty: 3 }]), { ok: true });
  assert.deepEqual(inventory.check(db.products, [{ id: 1, qty: 4 }]), {
    ok: false,
    msg: 'Rice is out of stock (4 sellable available)'
  });
});

test('Khata order debit uses opening balance plus billed minus settled and enforces credit limit', () => {
  const db = fixture();
  const charged = ledger.chargeOrderToKhata(db, 7, 300);
  assert.equal(charged.ok, true);
  assert.equal(charged.customer.totalBilled, 350);
  assert.equal(charged.customer.balance, 425);

  const overLimit = ledger.chargeOrderToKhata(db, 7, 100);
  assert.equal(overLimit.ok, false);
  assert.match(overLimit.error, /credit limit exceeded/i);
});

test('orders.add assigns and increments the next ID and defaults walk-in details', () => {
  const db = fixture();
  const order = orders.add(db, { subtotal: 100, discount: 0, tax: 5, total: 105 });

  assert.equal(order.id, 1001);
  assert.equal(db.nextOrderId, 1002);
  assert.equal(order.customer, 'Walk-in');
  assert.equal(order.paymentMode, 'cash');
  assert.equal(order.status, 'completed');
  assert.equal(db.orders[0], order);
});

test('cancelling a created order marks it cancelled but does not restore stock for id-shaped items', () => {
  const db = fixture();
  const order = orders.add(db, {
    items: [{ id: 1, qty: 2 }], paymentMode: 'cash', total: 200
  });
  inventory.reserve(db.products, order.items);

  const result = orders.cancel(db, order.id, 'test');

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(db.products[0].stock, 3);
});

test('dashboard includes pending orders in revenue and excludes cancelled orders', () => {
  const db = fixture();
  db.orders = [
    { id: 1, status: 'completed', total: 100, tax: 5, discount: 0 },
    { id: 2, status: 'pending', total: 40, tax: 2, discount: 3 },
    { id: 3, status: 'cancelled', total: 90, tax: 4, discount: 5 }
  ];

  const summary = reports.getDashboardSummary(db);
  assert.equal(summary.grossRevenue, 140);
  assert.equal(summary.totalTaxCollected, 7);
  assert.equal(summary.totalDiscountGiven, 3);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.cancelledCount, 1);
});
