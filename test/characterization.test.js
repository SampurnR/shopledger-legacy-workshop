// These assertions describe current behavior, including defects; they are not
// specifications of desired behavior. Use only fresh fixtures, never store.write.
var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');
var coupons = require('../lib/coupons');
var inventory = require('../lib/inventory');
var ledger = require('../lib/ledger');
var orders = require('../lib/orders');
var reports = require('../lib/reports');
var invoice = require('../lib/invoice');

function fixture() {
  return {
    products: [{ id: 1, name: 'Rice', stock: 10, reserved: 2, price: 100 }],
    customers: [{ id: 1, name: 'Customer', openingBalance: 0,
      totalBilled: 100, totalSettled: 20, creditLimit: 200 }],
    orders: [], settlements: [], nextOrderId: 1001, nextSettlementId: 501
  };
}

test('checkout apportions SAVE10 before HSN tax and splits GST', function () {
  var result = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 400, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ], ' save10 ');
  assert.deepEqual([result.subtotal, result.discount, result.taxable,
    result.tax, result.cgst, result.sgst, result.total],
  [500, 50, 450, 34.2, 17.1, 17.1, 484.2]);
  assert.deepEqual(result.lines.map(function (line) { return line.discount; }), [40, 10]);
});

test('coupons enforce minimum, cap, expiry, and normalization', function () {
  assert.equal(coupons.validate('SAVE10', 499).valid, false);
  assert.equal(coupons.validate(' save10 ', 500).discount, 50);
  assert.equal(coupons.calculateDiscount(2000, 'SAVE10'), 150);
  assert.equal(coupons.validate('DIWALI20', 2000).valid, false);
  assert.equal(coupons.validate('unknown', 2000).valid, false);
  assert.equal(coupons.validate('', 0).valid, true);
});

test('tax accepts decimal or percentage overrides; HSN lookup is exact, not prefix', function () {
  assert.equal(tax.getRateForItem({ gstRate: 5 }), 0.05);
  assert.equal(tax.getRateForItem({ gstRate: 0.05 }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: '1006' }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: '100630' }), 0.18);
  assert.deepEqual(tax.splitCgstSgst(0.05), { cgst: 0.03, sgst: 0.02 });
});

test('KNOWN DEFECT: stock check rejects exact sellable quantity but checks duplicate lines separately', function () {
  var db = fixture();
  assert.equal(inventory.getSellableStock(db.products[0]), 8);
  assert.equal(inventory.check(db.products, [{ id: 1, qty: 7 }]).ok, true);
  assert.equal(inventory.check(db.products, [{ id: 1, qty: 8 }]).ok, false);
  var items = [{ id: 1, qty: 6 }, { id: 1, qty: 6 }];
  assert.equal(inventory.check(db.products, items).ok, true);
  inventory.reserve(db.products, items);
  assert.equal(db.products[0].stock, -2);
});

test('khata allows the credit limit exactly and rejects charges above it without mutation', function () {
  var db = fixture();
  assert.equal(ledger.chargeOrderToKhata(db, 1, 120).ok, true);
  assert.equal(ledger.listCustomers(db)[0].balance, 200);
  assert.equal(ledger.chargeOrderToKhata(db, 1, 1).ok, false);
  assert.equal(ledger.listCustomers(db)[0].balance, 200);
});

test('KNOWN DEFECT: cancellation reverses khata once but does not restore order stock', function () {
  var db = fixture();
  var items = [{ id: 1, qty: 2 }];
  ledger.chargeOrderToKhata(db, 1, 50);
  inventory.reserve(db.products, items);
  var order = orders.add(db, { customerId: 1, paymentMode: 'khata', items: items, total: 50 });
  assert.equal(orders.cancel(db, order.id).ok, true);
  assert.equal(db.products[0].stock, 8);
  assert.equal(db.products[0].reserved, 2);
  assert.equal(ledger.listCustomers(db)[0].balance, 80);
  assert.equal(orders.cancel(db, order.id).ok, false);
  assert.equal(ledger.listCustomers(db)[0].balance, 80);
});

test('KNOWN DEFECT: string settlements concatenate with prior total while numeric settlements add', function () {
  var numeric = fixture();
  ledger.recordSettlement(numeric, 1, 5);
  assert.equal(numeric.customers[0].totalSettled, 25);
  var string = fixture();
  var result = ledger.recordSettlement(string, 1, '5');
  assert.equal(result.ok, true);
  assert.equal(string.customers[0].totalSettled, '205');
  assert.equal(string.customers[0].balance, -105);
  assert.equal(result.settlement.amount, 5);
});

test('KNOWN DEFECT: order filters and sorting compare display dates lexically', function () {
  var db = fixture();
  db.orders = [{ id: 1, date: '31/01/2026' }, { id: 2, date: '01/02/2026' }];
  assert.deepEqual(orders.list(db).map(function (o) { return o.id; }), [1, 2]);
  assert.deepEqual(orders.list(db, { from: '2026-02-01' }).map(function (o) { return o.id; }), [1, 2]);
});

test('invoice matches checkout HSN tax and coupon totals', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }];
  var totals = pricing.computeTotals(items, 'SAVE10');
  var order = Object.assign({ id: 1, items: items, coupon: 'SAVE10' }, totals);
  assert.deepEqual([totals.discount, totals.tax, totals.total], [150, 92.5, 1942.5]);
  var printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [150, 92.5, 1942.5]);
  var recon = reports.getGstReconciliation({ orders: [order] });
  assert.equal(recon.mismatchCount, 0);
  assert.equal(recon.totalDelta, 0);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('dashboard includes pending revenue and excludes cancelled revenue and reconciliation', function () {
  var db = fixture();
  db.orders = [
    { id: 1, status: 'pending', items: [], total: 100, tax: 10, discount: 5 },
    { id: 2, status: 'cancelled', items: [], total: 200, tax: 20, discount: 10 }
  ];
  var summary = reports.getDashboardSummary(db);
  assert.deepEqual([summary.totalOrders, summary.activeOrdersCount, summary.pendingCount,
    summary.cancelledCount, summary.grossRevenue, summary.totalTaxCollected], [2, 1, 1, 1, 100, 10]);
  assert.equal(reports.getGstReconciliation(db).totalChecked, 1);
});
