var assert = require('node:assert/strict');
var test = require('node:test');
var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function createBilledOrder(items, coupon) {
  var db = { nextOrderId: 1001, orders: [] };
  var totals = pricing.computeTotals(items, coupon);
  return orders.add(db, {
    date: '22/11/2026',
    items: items,
    coupon: coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
}

function mixedCart() {
  return [
    { id: 1, name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 600, qty: 1 }
  ];
}

test('invoice total and GST breakdown match checkout for a mixed-rate discounted order', function () {
  var order = createBilledOrder(mixedCart(), 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.total, order.total);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.subtotal, order.subtotal);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.cgst, 55.28);
  assert.equal(figures.sgst, 55.28);
  assert.deepEqual(figures.rows.map(function (row) {
    return { hsn: row.hsn, rate: row.gstPercent, tax: row.lineTax };
  }), [
    { hsn: '1006', rate: 5, tax: 45.31 },
    { hsn: '0405', rate: 12, tax: 65.25 }
  ]);
});

test('checkout caps SAVE10 and apportions it before applying line-specific GST', function () {
  var totals = pricing.computeTotals(mixedCart(), 'SAVE10');
  assert.equal(totals.subtotal, 1600);
  assert.equal(totals.discount, 150);
  assert.equal(totals.taxable, 1450);
  assert.equal(totals.tax, 110.56);
  assert.equal(totals.cgst, 55.28);
  assert.equal(totals.sgst, 55.28);
  assert.equal(totals.total, 1560.56);
  assert.deepEqual(totals.lines.map(function (line) {
    return { rate: line.gstPercent, discount: line.discount, taxable: line.taxable, tax: line.tax };
  }), [
    { rate: 5, discount: 93.75, taxable: 906.25, tax: 45.31 },
    { rate: 12, discount: 56.25, taxable: 543.75, tax: 65.25 }
  ]);
});

test('invoice preserves decimal and zero GST overrides in legacy line data', function () {
  var order = createBilledOrder([
    { id: 1, name: 'Rice', price: 100, qty: 1, gstRate: 0.05 },
    { id: 2, name: 'Tea', price: 100, qty: 1, gstRate: 0 }
  ], '');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 5);
  assert.equal(figures.rows[0].lineTax, 5);
  assert.equal(figures.rows[1].lineTax, 0);
  assert.equal(figures.tax, 5);
  assert.equal(figures.cgst, 2.5);
  assert.equal(figures.sgst, 2.5);
});

test('printable invoice displays billed GST and total without a mismatch notice', function () {
  var html = invoice.render(createBilledOrder(mixedCart(), 'SAVE10'));

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Total GST\)<\/td><td class="r">₹110\.56/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹1560\.56/);
});

test('GST reconciliation flags mismatches in tax or total and skips cancelled orders', function () {
  var mismatch = createBilledOrder(mixedCart(), 'SAVE10');
  var report = reports.getGstReconciliation({ orders: [
    Object.assign({}, mismatch, { total: 1500 }),
    Object.assign({}, mismatch, { id: 1002, tax: 100 }),
    Object.assign({}, mismatch, { id: 1003 }),
    Object.assign({}, mismatch, { id: 1004, total: 1500, status: 'cancelled' })
  ] });

  assert.equal(report.totalChecked, 3);
  assert.equal(report.mismatchCount, 2);
  assert.equal(report.totalDelta, 60.56);
  assert.deepEqual(report.rows.map(function (row) {
    return { id: row.orderId, delta: row.delta, matched: row.matched };
  }), [
    { id: 1001, delta: 60.56, matched: false },
    { id: 1002, delta: 0, matched: false },
    { id: 1003, delta: 0, matched: true }
  ]);
});
