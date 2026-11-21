var assert = require('node:assert/strict');
var test = require('node:test');
var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function billedOrder(items, coupon) {
  var db = { nextOrderId: 1001, orders: [] };
  var totals = pricing.computeTotals(items, coupon);
  return orders.add(db, {
    date: '2021-11-15',
    items: items,
    coupon: coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
}

test('an order without a coupon at the default GST rate matches the invoice', function () {
  var order = billedOrder([{ name: 'Tea', price: 100, qty: 2 }]);

  assert.equal(order.total, 236);
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 200,
    discount: 0,
    tax: 36,
    cgst: 18,
    sgst: 18,
    total: 236,
    rows: [{
      name: 'Tea', sku: '-', hsn: '-', qty: 2, price: 100,
      gstPercent: 18, line: 200, lineTax: 36
    }]
  });
  var html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹236\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('the invoice shows the billed total and GST breakdown for a mixed-HSN order', function () {
  var order = billedOrder([
    { name: 'Rice', sku: 'RICE', hsn: '1006', price: 500, qty: 2 },
    { name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 1000, qty: 1 }
  ], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([figures.total, figures.tax, figures.discount, figures.cgst, figures.sgst],
    [2007.25, 157.25, 150, 78.63, 78.62]);
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.hsn, row.gstPercent, row.lineTax];
  }), [['1006', 5, 46.25], ['0405', 12, 111]]);

  var html = invoice.render(order);
  assert.match(html, /5%<\/td><td class="r">₹46\.25/);
  assert.match(html, /12%<\/td><td class="r">₹111\.00/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('reconciliation matches invoice and billed figures for a capped coupon', function () {
  var order = billedOrder([
    { name: 'Rice', hsn: '1006', price: 1000, qty: 1 },
    { name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ], 'SAVE10');

  var reconciliation = reports.getGstReconciliation({ orders: [order] });
  var row = reconciliation.rows[0];
  assert.equal(reconciliation.mismatchCount, 0);
  assert.deepEqual([row.ledgerDiscount, row.invoiceDiscount, row.ledgerTax, row.invoiceTax, row.delta, row.matched],
    [150, 150, 157.25, 157.25, 0, true]);
});

test('the invoice applies zero, decimal and percent GST overrides like checkout', function () {
  var order = billedOrder([
    { name: 'Zero rate', price: 100, qty: 1, gstRate: 0 },
    { name: 'Decimal rate', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Percentage rate', price: 100, qty: 1, gstRate: 5 }
  ]);
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.tax, order.total], [10, 310]);
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.gstPercent, row.lineTax];
  }), [[0, 0], [5, 5], [5, 5]]);
  assert.deepEqual([figures.tax, figures.total], [10, 310]);
});

test('the invoice uses the same per-line GST rounding as checkout', function () {
  var order = billedOrder([
    { name: 'Sample A', price: 0.03, qty: 1 },
    { name: 'Sample B', price: 0.03, qty: 1 }
  ]);
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.tax, order.total], [0.02, 0.08]);
  assert.deepEqual(figures.rows.map(function (row) {
    return row.lineTax;
  }), [0.01, 0.01]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total],
    [0.02, 0.01, 0.01, 0.08]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('an expired coupon gives no discount when the order has no saved amounts', function () {
  var order = { items: [{ name: 'Tea', price: 1000, qty: 1 }], coupon: 'DIWALI20' };
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([figures.discount, figures.tax, figures.total], [0, 180, 1180]);
});

test('a flat coupon below its minimum gives no discount when the order has no saved amounts', function () {
  var order = { items: [{ name: 'Tea', price: 10, qty: 1 }], coupon: 'FLAT50' };
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([figures.discount, figures.tax, figures.total], [0, 1.8, 11.8]);
});

test('a historical invoice retains the billed amounts when current rules cannot reproduce its line GST', function () {
  var order = {
    id: 1001,
    items: [{ name: 'Rice', hsn: '1006', price: 1000, qty: 1 }],
    coupon: 'DIWALI20',
    subtotal: 1000,
    discount: 200,
    tax: 144,
    total: 944
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([figures.subtotal, figures.discount, figures.tax, figures.cgst, figures.sgst, figures.total],
    [1000, 200, 144, 72, 72, 944]);
  assert.deepEqual([figures.rows[0].gstPercent, figures.rows[0].lineTax], [null, null]);
  var html = invoice.render(order);
  assert.match(html, /<td class="r">-<\/td><td class="r">-<\/td>/);
  assert.match(html, /The original line-level GST is unavailable/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹944\.00/);
});
