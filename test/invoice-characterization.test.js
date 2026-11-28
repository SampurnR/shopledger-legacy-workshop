var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var orders = require('../lib/orders');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

// Match the checkout line shape, which records HSN but omits gstRate.
var items = [
  { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 500, qty: 2 },
  { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
];

function billedOrder(lines, coupon) {
  var totals = pricing.computeTotals(lines, coupon);
  return orders.add({ nextOrderId: 1, orders: [] }, {
    date: '15/03/2022',
    items: lines,
    coupon: coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
}

test('printed invoice matches the billed total and GST breakdown for a capped coupon', function () {
  var order = billedOrder(items, 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);

  assert.deepEqual(
    [figures.total, figures.tax, figures.discount],
    [order.total, order.tax, order.discount]
  );
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.gstPercent, row.lineTax];
  }), [[5, 46.25], [12, 111]]);
  assert.deepEqual([figures.cgst, figures.sgst], [78.63, 78.62]);
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹157.25'));
  assert.ok(html.includes('Invoice Total</td><td class="r">₹2007.25'));
  assert.ok(!html.includes('Accountant Reconciliation Notice'));
});

test('checkout caps SAVE10 and calculates GST on each discounted line', function () {
  var totals = pricing.computeTotals(items, 'SAVE10');
  assert.equal(totals.subtotal, 2000);
  assert.equal(totals.discount, 150);
  assert.equal(totals.taxable, 1850);
  assert.deepEqual(totals.lines.map(function (line) {
    return [line.gstPercent, line.discount, line.taxable, line.tax];
  }), [[5, 75, 925, 46.25], [12, 75, 925, 111]]);
  assert.equal(totals.tax, 157.25);
  assert.equal(totals.cgst, 78.63);
  assert.equal(totals.sgst, 78.62);
  assert.equal(totals.total, 2007.25);
});

test('invoice uses HSN rates when checkout lines have no gstRate', function () {
  var order = billedOrder(items, '');
  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(order.tax, 170);
  assert.equal(order.total, 2170);
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.hsn, row.gstPercent, row.lineTax];
  }), [['1006', 5, 50], ['0405', 12, 120]]);
  assert.equal(figures.tax, 170);
  assert.equal(figures.cgst, 85);
  assert.equal(figures.sgst, 85);
  assert.equal(figures.total, 2170);
});

test('invoice interprets an explicit decimal gstRate the same way checkout does', function () {
  var order = billedOrder([{ name: 'Rice', price: 100, qty: 1, gstRate: 0.05 }], '');
  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(order.tax, 5);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 5);
  assert.equal(figures.total, 105);
});

test('invoice adds the rounded line taxes and splits GST the same way checkout does', function () {
  var lines = [
    { name: 'Item A', price: 0.03, qty: 1 },
    { name: 'Item B', price: 0.03, qty: 1 }
  ];
  var order = billedOrder(lines, '');
  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(order.tax, 0.02);
  assert.equal(order.total, 0.08);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.equal(figures.tax, 0.02);
  assert.equal(figures.cgst, 0.01);
  assert.equal(figures.sgst, 0.01);
  assert.equal(figures.total, 0.08);
});

test('reconciliation skips cancelled orders and flags a tax difference even when totals match', function () {
  var billed = billedOrder(items, 'SAVE10');
  var taxOnly = { ...billed, id: 2, status: 'pending', tax: 160 };
  var totalOnly = { ...billed, id: 3, total: 2010 };
  var cancelled = { ...billed, id: 4, status: 'cancelled' };
  var result = reports.getGstReconciliation({ orders: [billed, taxOnly, totalOnly, cancelled] });

  assert.equal(result.totalChecked, 3);
  assert.equal(result.mismatchCount, 2);
  assert.equal(result.totalDelta, 2.75);
  assert.deepEqual(result.rows.map(function (row) {
    return [row.orderId, row.ledgerTax, row.invoiceTax, row.delta, row.matched];
  }), [[1, 157.25, 157.25, 0, true], [2, 160, 157.25, 0, false], [3, 157.25, 157.25, -2.75, false]]);
});
