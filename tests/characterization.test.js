// These assertions describe the legacy implementation, including known defects.
// Use fresh in-memory fixtures; never write the repository database.
var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');
var coupons = require('../lib/coupons');
var inventory = require('../lib/inventory');
var ledger = require('../lib/ledger');
var orders = require('../lib/orders');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function fixture() {
  return {
    products: [{ id: 1, name: 'Rice', stock: 10, reserved: 2 }],
    customers: [{ id: 1, name: 'Customer', openingBalance: 0,
      totalBilled: 100, totalSettled: 10, creditLimit: 200 }],
    orders: [], settlements: [], nextSettlementId: 501
  };
}

test('checkout apportions discount before item-specific GST', function () {
  var result = pricing.computeTotals([
    { id: 1, price: 500, qty: 1, hsn: '1006' },
    { id: 2, price: 500, qty: 1, hsn: '0902' }
  ], 'SAVE10');
  assert.deepEqual(result.lines.map(function (line) { return line.tax; }), [22.5, 81]);
  assert.equal(result.discount, 100);
  assert.equal(result.tax, 103.5);
  assert.equal(result.total, 1003.5);
});

test('coupons normalize codes, enforce minimums, expiry, and caps', function () {
  assert.equal(coupons.validate(' save10 ', 2000).discount, 150);
  assert.equal(coupons.validate('SAVE10', 499).valid, false);
  assert.equal(coupons.validate('DIWALI20', 2000).valid, false);
  assert.equal(coupons.validate('UNKNOWN', 2000).valid, false);
});

test('HSN lookup requires an exact key and explicit numeric rate wins', function () {
  assert.equal(tax.getRateForItem({ hsn: '1006' }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: '100630' }), 0.18);
  assert.equal(tax.getRateForItem({ hsn: '1006', gstRate: 12 }), 0.12);
});

test('legacy stock check rejects exactly the remaining sellable quantity', function () {
  var db = fixture();
  assert.equal(inventory.getSellableStock(db.products[0]), 8);
  assert.equal(inventory.check(db.products, [{ id: 1, qty: 7 }]).ok, true);
  assert.equal(inventory.check(db.products, [{ id: 1, qty: 8 }]).ok, false);
});

test('legacy cancellation reverses khata but does not restore checkout stock', function () {
  var db = fixture();
  var items = [{ id: 1, qty: 3 }];
  inventory.reserve(db.products, items);
  db.orders.push({ id: 1001, status: 'completed', items: items,
    paymentMode: 'khata', customerId: 1, total: 50 });
  assert.equal(orders.cancel(db, 1001).ok, true);
  assert.equal(db.products[0].stock, 7);
  assert.equal(db.products[0].reserved, 2);
  assert.equal(db.customers[0].totalBilled, 50);
  assert.equal(orders.cancel(db, 1001).ok, false);
  assert.equal(db.customers[0].totalBilled, 50);
});

test('khata allows the exact credit limit and rejects exceeding it', function () {
  var db = fixture();
  assert.equal(ledger.chargeOrderToKhata(db, 1, 110).ok, true);
  assert.equal(db.customers[0].balance, 200);
  assert.equal(ledger.chargeOrderToKhata(db, 1, 1).ok, false);
  assert.equal(db.customers[0].totalBilled, 210);
});

test('numeric settlement adds totals and rejects zero', function () {
  var db = fixture();
  assert.equal(ledger.recordSettlement(db, 1, 0).ok, false);
  var result = ledger.recordSettlement(db, 1, 5);
  assert.equal(result.customer.totalSettled, 15);
  assert.equal(result.customer.balance, 85);
  assert.equal(result.settlement.id, 501);
});

test('legacy string settlement concatenates totals while entry amount is numeric', function () {
  var result = ledger.recordSettlement(fixture(), 1, '5');
  assert.equal(result.customer.totalSettled, '105');
  assert.equal(result.customer.balance, -5);
  assert.equal(result.settlement.amount, 5);
});

test('invoice follows billed order HSN tax and coupon cap', function () {
  var items = [{ id: 1, name: 'Rice', price: 2000, qty: 1, hsn: '1006' }];
  var order = Object.assign({ id: 1001, items: items, coupon: 'SAVE10' },
    pricing.computeTotals(items, 'SAVE10'));
  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(order.total, 1942.5);
  assert.equal(figures.tax, 92.5);
  assert.equal(figures.discount, 150);
  assert.equal(figures.total, 1942.5);
  var recon = reports.getGstReconciliation({ orders: [order] });
  assert.equal(recon.mismatchCount, 0);
  assert.equal(recon.totalDelta, 0);
});

test('legacy date filtering and sorting compare day-first date strings', function () {
  var db = { orders: [
    { id: 1, date: '31/01/2021' }, { id: 2, date: '01/02/2021' }
  ] };
  assert.deepEqual(orders.list(db).map(function (o) { return o.id; }), [1, 2]);
  assert.deepEqual(orders.list(db, { from: '2021-02-01' }).map(function (o) {
    return o.id;
  }), [1, 2]);
});

test('dashboard revenue includes pending orders and excludes cancellations', function () {
  var db = fixture();
  db.orders = [
    { status: 'pending', total: 100, tax: 5, discount: 0, items: [] },
    { status: 'cancelled', total: 200, tax: 10, discount: 0, items: [] }
  ];
  var summary = reports.getDashboardSummary(db);
  assert.equal(summary.grossRevenue, 100);
  assert.equal(summary.totalOrders, 2);
  assert.equal(summary.activeOrdersCount, 1);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.cancelledCount, 1);
});
