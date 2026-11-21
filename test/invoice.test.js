var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function checkoutOrder(items, coupon = '') {
  var totals = pricing.computeTotals(items, coupon);
  // Mirror the amounts persisted by POST /api/orders.
  return {
    id: 1001,
    date: '21/11/2026',
    items: items,
    coupon: coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice and checkout agree for an undiscounted 18% item', function () {
  var order = checkoutOrder([{ name: 'Tea', hsn: '0902', price: 100, qty: 2 }]);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.total, 236);
  assert.equal(figures.total, 236);
  assert.equal(figures.tax, 36);
  assert.equal(figures.cgst, 18);
  assert.equal(figures.sgst, 18);
  assert.equal(figures.rows[0].gstPercent, 18);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice prints the billed total and discounted GST for a mixed-rate order', function () {
  var order = checkoutOrder([
    { name: 'Rice', hsn: '1006', price: 1000, qty: 1 },
    { name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ], 'SAVE10');

  assert.deepEqual([order.discount, order.tax, order.total], [150, 157.25, 2007.25]);

  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.total, order.total);
  assert.equal(figures.tax, order.tax);
  assert.deepEqual([figures.cgst, figures.sgst], [78.63, 78.62]);
  assert.deepEqual(figures.rows.map(function (row) { return [row.gstPercent, row.lineTax]; }), [
    [5, 46.25], [12, 111]
  ]);

  var html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹2007\.25/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>₹157\.25/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice uses the billed HSN rates for undiscounted 5% and 12% items', function () {
  var items = [
    { name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 },
    { name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 100, qty: 1 }
  ];
  var order = checkoutOrder(items);
  var billed = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(function (line) { return line.gstPercent; }), [5, 12]);
  assert.deepEqual(billed.lines.map(function (line) { return line.tax; }), [5, 12]);
  assert.equal(order.total, 217);
  assert.deepEqual([billed.tax, billed.cgst, billed.sgst], [17, 8.5, 8.5]);

  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [5, 12]);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [5, 12]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst], [17, 8.5, 8.5]);
  assert.equal(figures.total, 217);

  var html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹217\.00/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>₹17\.00/);
  assert.match(html, />5%<\/td><td[^>]*>₹5\.00/);
  assert.match(html, />12%<\/td><td[^>]*>₹12\.00/);
  assert.match(html, /Line GST is reconstructed using current tax and pricing rules/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice applies the capped percentage discount before GST', function () {
  var order = checkoutOrder([{ name: 'Tea', hsn: '0902', price: 2000, qty: 1 }], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.subtotal, 2000);
  assert.equal(order.discount, 150);
  assert.equal(order.tax, 333);
  assert.equal(order.total, 2183);
  assert.equal(figures.subtotal, 2000);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 333);
  assert.equal(figures.total, 2183);
  assert.match(invoice.render(order), /Coupon Discount \(SAVE10\)<\/td><td[^>]*>-₹150\.00/);
});

test('invoice reconstruction ignores inactive coupons and coupons below their minimum', function () {
  var items = [{ name: 'Tea', hsn: '0902', price: 200, qty: 1 }];
  var order = checkoutOrder(items);

  // Model stored coupon codes that current checkout validation would reject.
  assert.equal(invoice.computeInvoiceFigures({ ...order, coupon: 'DIWALI20' }).discount, 0);
  assert.equal(invoice.computeInvoiceFigures({ ...order, coupon: 'FLAT50' }).discount, 0);
});

test('invoice handles zero, decimal, and whole-percent GST rates as checkout does', function () {
  var items = [
    { name: 'Exempt item', gstRate: 0, price: 100, qty: 1 },
    { name: 'Decimal rate item', gstRate: 0.05, price: 100, qty: 1 },
    { name: 'Whole percent item', gstRate: 12, price: 100, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures(checkoutOrder(items));

  assert.deepEqual(billed.lines.map(function (line) { return line.tax; }), [0, 5, 12]);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [0, 5, 12]);
  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [0, 5, 12]);
});

test('invoice uses the same line rounding and GST split as checkout', function () {
  var items = [
    { name: 'Tea', hsn: '0902', price: 10.03, qty: 1 },
    { name: 'Coffee', hsn: '0901', price: 10.03, qty: 1 }
  ];
  var order = checkoutOrder(items);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 3.62);
  assert.equal(order.total, 23.68);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [1.81, 1.81]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst], [3.62, 1.81, 1.81]);
  assert.equal(figures.total, 23.68);
});

test('invoice and reconciliation match checkout when a coupon changes the taxable amount', function () {
  var order = checkoutOrder([{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }], 'WELCOME');
  var figures = invoice.computeInvoiceFigures(order);
  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(order.tax, 17.1);
  assert.equal(figures.tax, 17.1);
  assert.equal(order.total, 112.1);
  assert.equal(figures.total, 112.1);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});

test('historical invoice uses the recorded bill and flags a GST breakdown it cannot verify', function () {
  var order = checkoutOrder([{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }], 'WELCOME');
  order.discount = 5.9;
  order.tax = 18;

  var html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹112\.10/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>₹18\.00/);
  assert.match(html, /Coupon Discount \(WELCOME\)<\/td><td[^>]*>-₹5\.90/);
  assert.match(html, /<td class="r">&mdash;<\/td><td class="r">&mdash;<\/td>/);
  assert.match(html, /Line-level GST is unavailable/);

  var reconciliation = reports.getGstReconciliation({ orders: [order] });
  assert.equal(reconciliation.mismatchCount, 1);
  assert.equal(reconciliation.totalDelta, 0);
});

test('invoice retains the recorded total when it differs from the reconstructed total', function () {
  var order = checkoutOrder([{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]);
  order.total = 106;

  var html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹106\.00/);
  assert.match(html, />5%<\/td><td[^>]*>₹5\.00/);
  assert.match(html, /Accountant Reconciliation Notice/);
});

test('invoice identifies a missing recorded total as an estimate', function () {
  var order = checkoutOrder([{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]);
  order.tax = 6;
  delete order.total;

  var html = invoice.render(order);
  assert.match(html, /Invoice Total \(estimated\)<\/td><td[^>]*>₹106\.00/);
  assert.match(html, /The estimated total uses the recorded subtotal, discount and GST/);
  assert.match(html, /Accountant Reconciliation Notice/);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 1);
});

test('unreadable GST and a missing total are shown as unavailable', function () {
  var order = checkoutOrder([{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]);
  order.tax = 'unknown';
  delete order.total;

  var html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>&mdash;/);
  assert.match(html, /Invoice Total<\/td><td[^>]*>&mdash;/);
  assert.match(html, /Accountant Reconciliation Notice/);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 1);
});

test('subtotal and discount drift alone only warns about the line breakdown', function () {
  var order = checkoutOrder([{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]);
  order.subtotal = 105;
  order.discount = 5;

  var html = invoice.render(order);
  assert.match(html, /Line-level GST is unavailable/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 0);
});
