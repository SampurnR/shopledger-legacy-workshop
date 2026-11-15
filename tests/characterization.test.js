var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

// These assertions describe current behavior, including known defects.
// Fixtures stay in memory: never read or write data/db.json.
test('pricing applies capped discounts before item-specific GST', function () {
  var totals = pricing.computeTotals([
    { price: 1000, qty: 1, hsn: '1006' },
    { price: 1000, qty: 1, hsn: '0902' }
  ], 'SAVE10');
  assert.equal(totals.subtotal, 2000);
  assert.equal(totals.discount, 150);
  assert.equal(totals.tax, 212.75);
  assert.equal(totals.total, 2062.75);
  assert.equal(totals.cgst + totals.sgst, totals.tax);
});

test('coupons normalize input and enforce minimum, cap, and expiry', function () {
  assert.equal(coupons.validate(' save10 ', 500).code, 'SAVE10');
  assert.equal(coupons.validate('SAVE10', 499).valid, false);
  assert.equal(coupons.calculateDiscount(2000, 'SAVE10'), 150);
  assert.equal(coupons.validate('DIWALI20', 2000).valid, false);
  assert.equal(coupons.validate('unknown', 2000).valid, false);
});

test('stock check excludes reservations and rejects buying all sellable units', function () {
  var products = [{ id: 1, name: 'Rice', stock: 10, reserved: 2 }];
  assert.equal(inventory.getSellableStock(products[0]), 8);
  assert.equal(inventory.check(products, [{ id: 1, qty: 7 }]).ok, true);
  assert.equal(inventory.check(products, [{ id: 1, qty: 8 }]).ok, false);
});

test('KNOWN DEFECT: cancellation reverses khata but does not restore physical stock', function () {
  var db = {
    products: [{ id: 1, stock: 10, reserved: 2 }],
    customers: [{ id: 1, totalBilled: 100, totalSettled: 0 }],
    orders: [{ id: 1, items: [{ id: 1, qty: 3 }], total: 100,
      paymentMode: 'khata', customerId: 1, status: 'completed' }]
  };
  inventory.reserve(db.products, db.orders[0].items);
  assert.equal(orders.cancel(db, 1).ok, true);
  assert.equal(db.products[0].stock, 7);
  assert.equal(db.products[0].reserved, 2);
  assert.equal(db.customers[0].totalBilled, 0);
  assert.equal(orders.cancel(db, 1).ok, false);
});

test('khata permits the credit limit exactly and rejects exceeding it without mutation', function () {
  var db = { customers: [{ id: 1, openingBalance: 50, totalBilled: 0,
    totalSettled: 0, creditLimit: 100 }] };
  assert.equal(ledger.chargeOrderToKhata(db, 1, 50).ok, true);
  assert.equal(ledger.chargeOrderToKhata(db, 1, 1).ok, false);
  assert.equal(db.customers[0].balance, 100);
});

test('KNOWN DEFECT: date filtering and sorting compare day-first strings', function () {
  var db = { orders: [
    { id: 1, date: '31/01/2026' }, { id: 2, date: '01/02/2026' }
  ] };
  assert.deepEqual(orders.list(db).map(function (o) { return o.id; }), [1, 2]);
  assert.deepEqual(orders.list(db, { from: '2026-02-01' })
    .map(function (o) { return o.id; }), [1, 2]);
});

test('invoice respects HSN slabs and coupon caps; reconciliation matches billing', function () {
  var items = [{ name: 'Rice', price: 2000, qty: 1, hsn: '1006' }];
  var totals = pricing.computeTotals(items, 'SAVE10');
  var order = Object.assign({ id: 1, items: items, coupon: 'SAVE10' }, totals);
  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(order.total, 1942.5);
  assert.equal(figures.tax, 92.5);
  assert.equal(figures.discount, 150);
  assert.equal(figures.total, 1942.5);
  var recon = reports.getGstReconciliation({ orders: [order] });
  assert.equal(recon.mismatchCount, 0);
  assert.equal(recon.totalDelta, 0);
});

test('dashboard includes pending revenue and excludes cancelled orders', function () {
  var summary = reports.getDashboardSummary({ products: [], customers: [], orders: [
    { status: 'pending', total: 100, tax: 5, discount: 0, subtotal: 95, items: [] },
    { status: 'cancelled', total: 200, tax: 10, discount: 0, items: [] }
  ] });
  assert.equal(summary.grossRevenue, 100);
  assert.equal(summary.totalOrders, 2);
  assert.equal(summary.activeOrdersCount, 1);
  assert.equal(summary.pendingCount, 1);
});
