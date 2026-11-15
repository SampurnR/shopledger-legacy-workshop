var test = require('node:test');
var assert = require('node:assert/strict');
var dates = require('../lib/dates');
var orders = require('../lib/orders');
var reports = require('../lib/reports');
var store = require('../lib/store');
var helpers = require('./helpers');

test('current behavior: ISO input becomes a display date; fiscal year changes in April', function () {
  assert.equal(dates.normalizeDateKey('2022-01-05'), '05/01/2022');
  assert.equal(dates.getFiscalYear('2022-03-31'), 'FY21-22');
  assert.equal(dates.getFiscalYear('2022-04-01'), 'FY22-23');
});

test('REGRESSION: order sorting and range filters compare chronological date keys', function () {
  var db = helpers.createDb();
  db.orders = [{ id: 1, date: '28/12/2021' }, { id: 2, date: '05/01/2022' }];
  assert.deepEqual(orders.list(db).map(function (order) { return order.id; }), [2, 1]);
  assert.deepEqual(orders.list(db, { from: '2022-01-01', to: '2022-01-31' })
    .map(function (order) { return order.id; }), [2]);
});

test('current behavior: dashboard includes pending Khata orders and excludes cancellations', function () {
  var db = helpers.createDb();
  db.orders = [
    { id: 1, status: 'pending', paymentMode: 'khata', subtotal: 100, discount: 0, tax: 18,
      total: 118, items: [{ price: 100, qty: 1 }] },
    { id: 2, status: 'cancelled', subtotal: 100, discount: 0, tax: 18, total: 118, items: [] }
  ];
  var summary = reports.getDashboardSummary(db);
  assert.deepEqual([summary.grossRevenue, summary.totalTaxCollected, summary.totalOrders,
    summary.activeOrdersCount, summary.pendingCount, summary.cancelledCount], [118, 18, 2, 1, 1, 1]);
  assert.equal(summary.totalKhataReceivable, 450);
});

test('current behavior: reconciliation reports absolute total differences and skips cancelled orders', function () {
  var db = helpers.createDb();
  db.orders = [
    { id: 1, subtotal: 640, discount: 0, tax: 32, total: 672,
      items: [{ hsn: '1006', price: 640, qty: 1 }] },
    { id: 2, status: 'cancelled', subtotal: 640, discount: 0, tax: 32, total: 672, items: [] }
  ];
  var result = reports.getGstReconciliation(db);
  assert.deepEqual([result.totalChecked, result.mismatchCount, result.totalDelta], [1, 1, 83.2]);
  assert.deepEqual([result.rows[0].ledgerTotal, result.rows[0].invoiceTotal, result.rows[0].matched],
    [672, 755.2, false]);
});

test('current behavior: audit history keeps the newest 100 entries in memory', function () {
  var db = helpers.createDb();
  for (var i = 0; i < 101; i++) store.appendAudit(db, 'TEST', String(i));
  assert.equal(db.auditLog.length, 100);
  assert.equal(db.auditLog[0].details, '100');
  assert.equal(db.auditLog[99].details, '1');
});
