var assert = require('node:assert/strict');
var test = require('node:test');
var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function bill(items, coupon) {
  var totals = pricing.computeTotals(items, coupon);
  var db = { orders: [], nextOrderId: 1001 };
  var order = orders.add(db, {
    date: '17/11/2021',
    items: items,
    coupon: coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });

  return { db: db, order: order, totals: totals };
}

test('invoice and billed totals agree for an undiscounted 18% item', function () {
  var sale = bill([{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }]);
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.equal(sale.order.total, 118);
  assert.equal(figures.total, 118);
  assert.equal(figures.tax, 18);
  assert.equal(figures.cgst, 9);
  assert.equal(figures.sgst, 9);
  assert.equal(reports.getGstReconciliation(sale.db).rows[0].matched, true);
  assert.doesNotMatch(invoice.render(sale.order), /Line-level GST could not be reconstructed/);
});

test('invoice uses the billed HSN slabs and the capped pre-tax coupon', function () {
  var sale = bill([
    { id: 1, name: 'Rice', hsn: '1006', price: 800, qty: 2 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 400, qty: 1 }
  ], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.deepEqual(sale.totals.lines.map(function (line) {
    return [line.gstPercent, line.discount, line.taxable, line.tax];
  }), [[5, 120, 1480, 74], [12, 30, 370, 44.40]]);
  assert.deepEqual(
    [sale.order.subtotal, sale.order.discount, sale.order.tax, sale.totals.cgst, sale.totals.sgst, sale.order.total],
    [2000, 150, 118.40, 59.20, 59.20, 1968.40]
  );

  assert.deepEqual(figures.rows.map(function (line) {
    return [line.gstPercent, line.lineTax];
  }), [[5, 74], [12, 44.40]]);
  assert.deepEqual(
    [figures.subtotal, figures.discount, figures.tax, figures.cgst, figures.sgst, figures.total],
    [2000, 150, 118.40, 59.20, 59.20, 1968.40]
  );

  var html = invoice.render(sale.order);
  assert.match(html, /GST %<\/th>.*5%<\/td>.*₹74\.00<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹118\.40/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹1968\.40/);
  assert.doesNotMatch(html, /Line-level GST could not be reconstructed/);

  var report = reports.getGstReconciliation(sale.db);
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.totalDelta, 0);
  assert.equal(report.rows[0].ledgerTax, 118.40);
  assert.equal(report.rows[0].invoiceTax, 118.40);
  assert.equal(report.rows[0].matched, true);
});

test('invoice calculates GST after subtracting a flat coupon', function () {
  var sale = bill([{ name: 'Tea', hsn: '0902', price: 300, qty: 1 }], 'FLAT50');
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.deepEqual([sale.order.discount, sale.order.tax, sale.order.total], [50, 45, 295]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [50, 45, 295]);
});

test('invoice handles percentage, decimal, and zero GST rates like checkout', function () {
  var sale = bill([
    { name: 'Percentage rate', price: 100, qty: 1, gstRate: 5 },
    { name: 'Decimal rate', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Zero rate', price: 100, qty: 1, gstRate: 0 }
  ]);
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.deepEqual(sale.totals.lines.map(function (line) {
    return line.tax;
  }), [5, 5, 0]);
  assert.deepEqual(figures.rows.map(function (line) {
    return [line.gstPercent, line.lineTax];
  }), [[5, 5], [5, 5], [0, 0]]);
  assert.equal(sale.order.total, 310);
  assert.equal(figures.total, 310);
});

test('invoice totals rounded line GST like checkout', function () {
  var sale = bill([
    { name: 'First line', price: 0.03, qty: 1 },
    { name: 'Second line', price: 0.03, qty: 1 }
  ]);
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.deepEqual(figures.rows.map(function (line) {
    return line.lineTax;
  }), [0.01, 0.01]);
  assert.deepEqual([sale.order.tax, sale.order.total], [0.02, 0.08]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [0.02, 0.01, 0.01, 0.08]);
});

test('invoice preserves historical billed totals when line GST cannot be reconstructed', function () {
  var sale = bill([{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]);
  sale.order.tax = 18;
  sale.order.total = 118;

  var figures = invoice.computeInvoiceFigures(sale.order);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [18, 9, 9, 118]);
  assert.deepEqual([figures.rows[0].gstPercent, figures.rows[0].lineTax], [null, null]);
  var report = reports.getGstReconciliation(sale.db);
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.rows[0].matched, true);
  assert.match(invoice.render(sale.order), /Line-level GST could not be reconstructed/);
});

test('invoice uses the recorded discount when reconstructing line GST', function () {
  var sale = bill([{ name: 'Rice', hsn: '1006', price: 640, qty: 1 }], 'SAVE10');
  sale.order.discount = 40;
  sale.order.tax = 30;
  sale.order.total = 630;

  var figures = invoice.computeInvoiceFigures(sale.order);
  assert.deepEqual([figures.discount, figures.rows[0].lineTax, figures.total], [40, 30, 630]);
});

test('invoice shows the billed total and GST breakdown for a discounted HSN item', function () {
  var sale = bill([{ name: 'Rice', hsn: '1006', price: 640, qty: 1 }], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.deepEqual(
    [figures.total, figures.tax, figures.cgst, figures.sgst, figures.rows[0].gstPercent, figures.rows[0].lineTax],
    [604.80, 28.80, 14.40, 14.40, 5, 28.80]
  );
});

test('invoice derives a missing total from the recorded subtotal, discount, and GST', function () {
  var order = {
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 18
  };
  assert.equal(invoice.computeInvoiceFigures(order).total, 118);
});

test('invoice labels line GST reconstructed from current rates even when its sum matches', function () {
  var sale = bill([
    { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
  ]);
  assert.equal(sale.order.tax, 17);
  assert.match(invoice.render(sale.order), /Line-level GST is reconstructed using current rates/);
});
