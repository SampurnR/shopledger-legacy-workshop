var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');
var tax = require('../lib/tax');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

// These tests describe today's behavior, including defects, rather than desired behavior.
function fixture() {
  return {
    products: [{ id: 1, name: 'Rice', stock: 10, reserved: 2, price: 100 }],
    customers: [{ id: 1, name: 'Customer', openingBalance: 0,
      totalBilled: 100, totalSettled: 20, creditLimit: 200 }],
    orders: [], settlements: [], nextOrderId: 1001, nextSettlementId: 501
  };
}

test('checkout allocates discount before applying each HSN GST slab', function () {
  var result = pricing.computeTotals([
    { id: 1, price: 500, qty: 1, hsn: '1006' },
    { id: 2, price: 500, qty: 1, hsn: '0902' }
  ], ' save10 ');
  assert.equal(result.discount, 100);
  assert.deepEqual(result.lines.map(function (line) { return line.tax; }), [22.5, 81]);
  assert.equal(result.taxable, 900);
  assert.equal(result.total, 1003.5);
  assert.equal(result.cgst + result.sgst, result.tax);
});

test('coupons enforce minimums, caps, normalization, and expiry', function () {
  assert.equal(coupons.calculateDiscount(499, 'SAVE10'), 0);
  assert.equal(coupons.calculateDiscount(500, ' save10 '), 50);
  assert.equal(coupons.calculateDiscount(2000, 'SAVE10'), 150);
  assert.equal(coupons.validate('DIWALI20', 2000).valid, false);
  assert.equal(coupons.validate('unknown', 2000).valid, false);
});

test('GST accepts decimal or percentage overrides but HSN lookup is exact', function () {
  assert.equal(tax.getRateForItem({ gstRate: 5 }), 0.05);
  assert.equal(tax.getRateForItem({ gstRate: 0.05 }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: '1006' }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: '100630' }), 0.18);
  assert.deepEqual(tax.splitCgstSgst(0.05), { cgst: 0.03, sgst: 0.02 });
});

test('inventory excludes reservations and rejects buying all sellable units', function () {
  var db = fixture();
  assert.equal(inventory.getSellableStock(db.products[0]), 8);
  assert.equal(inventory.check(db.products, [{ id: 1, qty: 7 }]).ok, true);
  assert.equal(inventory.check(db.products, [{ id: 1, qty: 8 }]).ok, false);
});

test('current defect: duplicate lines pass stock validation independently', function () {
  var db = fixture();
  var items = [{ id: 1, qty: 6 }, { id: 1, qty: 6 }];
  assert.equal(inventory.check(db.products, items).ok, true);
  inventory.reserve(db.products, items);
  assert.equal(db.products[0].stock, -2);
});

test('current defect: cancellation reverses khata but does not replenish normal order items', function () {
  var db = fixture();
  var items = [{ id: 1, qty: 2 }];
  inventory.reserve(db.products, items);
  var order = orders.add(db, { items: items, paymentMode: 'khata', customerId: 1, total: 50 });
  assert.equal(orders.cancel(db, order.id).ok, true);
  assert.equal(db.products[0].stock, 8);
  assert.equal(db.products[0].reserved, 2);
  assert.equal(db.customers[0].totalBilled, 50);
  assert.equal(orders.cancel(db, order.id).ok, false);
  assert.equal(db.customers[0].totalBilled, 50);
});

test('khata allows the credit limit exactly and rejects exceeding it without mutation', function () {
  var db = fixture();
  assert.equal(ledger.chargeOrderToKhata(db, 1, 120).ok, true);
  assert.equal(db.customers[0].balance, 200);
  assert.equal(ledger.chargeOrderToKhata(db, 1, 1).ok, false);
  assert.equal(db.customers[0].totalBilled, 220);
});

test('numeric settlements update balances and allow overpayment', function () {
  var db = fixture();
  var result = ledger.recordSettlement(db, 1, 100);
  assert.equal(result.ok, true);
  assert.equal(result.customer.balance, -20);
  assert.equal(result.settlement.id, 501);
  assert.equal(result.settlement.mode, 'upi');
  assert.equal(ledger.recordSettlement(db, 1, 0).ok, false);
});

test('current defect: string settlement concatenates the stored total', function () {
  var db = fixture();
  var result = ledger.recordSettlement(db, 1, '10');
  assert.equal(result.customer.totalSettled, '2010');
  assert.equal(result.customer.balance, -1910);
  assert.equal(result.settlement.amount, 10);
});

test('current defect: order dates sort and filter lexically in day-first format', function () {
  var db = fixture();
  db.orders = [
    { id: 1, date: '31/01/2026' },
    { id: 2, date: '01/02/2026' }
  ];
  assert.deepEqual(orders.list(db).map(function (o) { return o.id; }), [1, 2]);
  assert.deepEqual(orders.list(db, { from: '2026-02-01' }).map(function (o) { return o.id; }), [1, 2]);
});

test('invoice agrees with checkout and reconciliation excludes cancelled orders', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }];
  var totals = pricing.computeTotals(items, 'SAVE10');
  var order = Object.assign({ id: 1, items: items, coupon: 'SAVE10' }, totals);
  assert.equal(totals.total, 1942.5);
  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.tax, 92.5);
  assert.equal(figures.discount, 150);
  assert.equal(figures.total, 1942.5);
  var result = reports.getGstReconciliation({ orders: [order,
    Object.assign({}, order, { id: 2, status: 'cancelled' })] });
  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
});

test('dashboard counts pending orders as revenue and excludes cancelled totals', function () {
  var db = fixture();
  db.orders = [
    { status: 'pending', items: [], total: 100, tax: 5, discount: 10 },
    { status: 'cancelled', items: [], total: 500, tax: 50 }
  ];
  var summary = reports.getDashboardSummary(db);
  assert.equal(summary.grossRevenue, 100);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.totalOrders, 2);
  assert.equal(summary.activeOrdersCount, 1);
  assert.equal(summary.totalKhataReceivable, 80);
});
