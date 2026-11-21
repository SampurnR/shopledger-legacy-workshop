var assert = require('node:assert/strict');
var test = require('node:test');

var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function billOrder(items, coupon) {
  var db = { nextOrderId: 1001, orders: [] };
  var billed = pricing.computeTotals(items, coupon);
  var order = orders.add(db, {
    date: '2021-11-21',
    items: items,
    coupon: coupon,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });
  return { db: db, order: order };
}

test('invoice matches an undiscounted sale at the default GST rate', function () {
  var sale = billOrder([{ name: 'Tea', price: 100, qty: 2 }]);
  assert.deepEqual(invoice.computeInvoiceFigures(sale.order), {
    subtotal: 200,
    discount: 0,
    tax: 36,
    cgst: 18,
    sgst: 18,
    total: 236,
    rows: [{ name: 'Tea', sku: '-', hsn: '-', qty: 2, price: 100, gstPercent: 18, line: 200, lineTax: 36 }]
  });
  assert.equal(sale.order.total, 236);
  assert.doesNotMatch(invoice.render(sale.order), /Accountant Reconciliation Notice/);
});

test('invoice shows the billed total and discounted GST for a capped mixed-slab sale', function () {
  var sale = billOrder([
    { name: 'Rice', hsn: '1006', price: 1000, qty: 1 },
    { name: 'Spices', hsn: '0904', price: 1000, qty: 1 }
  ], 'SAVE10');

  var figures = invoice.computeInvoiceFigures(sale.order);
  assert.equal(figures.total, sale.order.total, 'invoice must show the amount billed');
  assert.equal(figures.total, 2007.25);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 157.25);
  assert.equal(figures.cgst, 78.63);
  assert.equal(figures.sgst, 78.62);
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.hsn, row.gstPercent, row.lineTax];
  }), [['1006', 5, 46.25], ['0904', 12, 111]]);

  var html = invoice.render(sale.order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  var reconciliation = reports.getGstReconciliation(sale.db);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});

test('invoice uses the same percent, decimal, and zero GST rates as billing', function () {
  var sale = billOrder([
    { name: 'Percent rate', price: 100, qty: 1, gstRate: 5 },
    { name: 'Decimal rate', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Zero rate', price: 100, qty: 1, gstRate: 0 }
  ]);

  var figures = invoice.computeInvoiceFigures(sale.order);
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.gstPercent, row.lineTax];
  }), [[5, 5], [5, 5], [0, 0]]);
  assert.equal(figures.total, sale.order.total);
  assert.equal(figures.total, 310);
});

test('invoice GST sums the rounded line amounts used by billing', function () {
  var sale = billOrder([
    { name: 'First line', price: 0.03, qty: 1 },
    { name: 'Second line', price: 0.03, qty: 1 }
  ]);

  var figures = invoice.computeInvoiceFigures(sale.order);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.equal(figures.tax, 0.02);
  assert.equal(figures.cgst, 0.01);
  assert.equal(figures.sgst, 0.01);
  assert.equal(figures.total, sale.order.total);
  assert.equal(figures.total, 0.08);
});

test('invoice still warns when the stored total differs from the calculated total', function () {
  var sale = billOrder([{ name: 'Tea', price: 100, qty: 1 }]);
  sale.order.total = 120;
  assert.match(invoice.render(sale.order), /differs from Order Ledger recorded total \(₹120\.00\) by -₹2\.00/);
});
