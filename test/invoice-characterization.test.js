var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var reports = require('../lib/reports');

// Only in-memory orders: do not import the server, routes, or persistence store.
function billedOrder(items, coupon) {
  var totals = pricing.computeTotals(items, coupon);
  return orders.add({ orders: [], nextOrderId: 1 }, {
    date: '15/11/2026',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
}

function figures(value) {
  return [value.subtotal, value.discount, value.tax, value.total];
}

test('invoice uses checkout GST for mixed HSN slabs', function () {
  var order = billedOrder([
    { id: 1, name: 'Rice', price: 100, qty: 1, hsn: '1006' },
    { id: 2, name: 'Ghee', price: 100, qty: 1, hsn: '0405' },
    { id: 3, name: 'Tea', price: 100, qty: 1, hsn: '0902' }
  ]);
  var calc = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures(order), [300, 0, 35, 335]);
  assert.deepEqual(figures(calc), [300, 0, 35, 335]);
  assert.deepEqual(calc.rows.map(function (row) { return row.gstPercent; }), [5, 12, 18]);
  assert.deepEqual([calc.cgst, calc.sgst], [17.5, 17.5]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice:/);
});

test('percentage coupon matches both billed total and GST', function () {
  var order = billedOrder([{ id: 1, name: 'Tea', price: 1000, qty: 1, hsn: '0902' }], 'SAVE10');
  var calc = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures(order), [1000, 100, 162, 1062]);
  assert.deepEqual(figures(calc), [1000, 100, 162, 1062]);
  assert.deepEqual([calc.cgst, calc.sgst], [81, 81]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice:/);
  var result = reports.getGstReconciliation({ orders: [order] });
  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].matched, true);
  assert.equal(result.rows[0].delta, 0);
});

test('invoice applies percentage coupon cap before GST', function () {
  var order = billedOrder([{ id: 1, name: 'Tea', price: 2000, qty: 1, hsn: '0902' }], 'SAVE10');
  assert.deepEqual(figures(order), [2000, 150, 333, 2183]);
  assert.deepEqual(figures(invoice.computeInvoiceFigures(order)), [2000, 150, 333, 2183]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice:/);
  var result = reports.getGstReconciliation({ orders: [order] });
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.totalDelta, 0);
});

test('flat coupon reduces invoice taxable value before GST', function () {
  var order = billedOrder([{ id: 1, name: 'Tea', price: 500, qty: 1, hsn: '0902' }], 'FLAT50');
  assert.deepEqual(figures(order), [500, 50, 81, 531]);
  assert.deepEqual(figures(invoice.computeInvoiceFigures(order)), [500, 50, 81, 531]);
});

test('invoice ignores expired and below-minimum coupons on existing orders', function () {
  // These characterize stored-order calculations; checkout rejects these codes/subtotals.
  var items = [{ id: 1, price: 100, qty: 1, hsn: '0902' }];
  var expired = billedOrder(items, 'DIWALI20');
  var belowMinimum = billedOrder(items, 'FLAT50');
  assert.deepEqual(figures(expired), [100, 0, 18, 118]);
  assert.deepEqual(figures(invoice.computeInvoiceFigures(expired)), [100, 0, 18, 118]);
  assert.deepEqual(figures(invoice.computeInvoiceFigures(belowMinimum)), [100, 0, 18, 118]);
  var tiny = billedOrder([{ id: 1, price: 10, qty: 1 }], 'FLAT50');
  assert.deepEqual(figures(invoice.computeInvoiceFigures(tiny)), [10, 0, 1.8, 11.8]);
});

test('invoice normalizes coupon lookup like checkout', function () {
  var order = billedOrder([{ id: 1, price: 1000, qty: 1, hsn: '0902' }], ' save10 ');
  assert.deepEqual(figures(order), [1000, 100, 162, 1062]);
  assert.deepEqual(figures(invoice.computeInvoiceFigures(order)), [1000, 100, 162, 1062]);
});

test('invoice handles percentage, decimal and zero GST overrides like checkout', function () {
  [
    { rate: 5, billedTax: 5, invoiceTax: 5, percent: 5 },
    { rate: 0.05, billedTax: 5, invoiceTax: 5, percent: 5 },
    { rate: 0, billedTax: 0, invoiceTax: 0, percent: 0 }
  ].forEach(function (example) {
    var order = billedOrder([{ id: 1, price: 100, qty: 1, gstRate: example.rate }]);
    var calc = invoice.computeInvoiceFigures(order);
    assert.equal(order.tax, example.billedTax);
    assert.equal(calc.tax, example.invoiceTax);
    assert.equal(calc.rows[0].gstPercent, example.percent);
  });
});

test('invoice sums rounded line GST like checkout', function () {
  var order = billedOrder([
    { id: 1, price: 0.03, qty: 1 },
    { id: 2, price: 0.03, qty: 1 }
  ]);
  var calc = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures(order), [0.06, 0, 0.02, 0.08]);
  assert.deepEqual(figures(calc), [0.06, 0, 0.02, 0.08]);
  assert.deepEqual(calc.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.deepEqual([calc.cgst, calc.sgst], [0.01, 0.01]);
});

test('CURRENT BEHAVIOUR: invoice recomputes figures instead of using saved ledger amounts', function () {
  var order = billedOrder([{ id: 1, price: 100, qty: 1 }]);
  order.subtotal = 900;
  order.discount = 100;
  order.tax = 200;
  order.total = 1000;
  var before = JSON.parse(JSON.stringify(order));
  assert.deepEqual(figures(invoice.computeInvoiceFigures(order)), [100, 0, 18, 118]);
  invoice.render(order);
  assert.deepEqual(order, before);
});
