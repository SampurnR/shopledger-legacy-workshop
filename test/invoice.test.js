var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function checkoutFixture() {
  // Match the line shape created in routes/orders.js, including the omitted gstRate.
  var items = [
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ];
  var coupon = 'SAVE10';
  var totals = pricing.computeTotals(items, coupon);
  var db = { nextOrderId: 1, orders: [] };
  var order = orders.add(db, {
    date: '26/11/2026',
    items: items,
    coupon: coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
  return { db: db, order: order, totals: totals };
}

test('checkout caps the coupon and applies HSN GST to the discounted lines', function () {
  var fixture = checkoutFixture();
  var totals = fixture.totals;
  assert.equal(totals.subtotal, 2000);
  assert.equal(totals.discount, 150);
  assert.equal(totals.taxable, 1850);
  assert.deepEqual(totals.lines.map(function (line) {
    return [line.gstPercent, line.discount, line.taxable, line.tax];
  }), [[5, 75, 925, 46.25], [12, 75, 925, 111]]);
  assert.equal(totals.tax, 157.25);
  assert.equal(totals.cgst, 78.63);
  assert.equal(totals.sgst, 78.62);
  assert.equal(fixture.order.total, 2007.25);
});

test('a new order invoice matches the billed total and GST breakdown', function () {
  var fixture = checkoutFixture();
  var figures = invoice.computeInvoiceFigures(fixture.order);
  assert.equal(figures.total, fixture.order.total);
  assert.equal(figures.tax, fixture.order.tax);
  assert.equal(figures.cgst, fixture.totals.cgst);
  assert.equal(figures.sgst, fixture.totals.sgst);
});

test('invoice uses HSN rates and the capped checkout discount for line GST', function () {
  var order = checkoutFixture().order;
  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.subtotal, 2000);
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.gstPercent, row.lineTax];
  }), [[5, 46.25], [12, 111]]);
  assert.equal(figures.discount, 150);
});

test('invoice and checkout agree on decimal, percentage, and zero GST rates', function () {
  var items = [
    { name: 'Rice', hsn: '1006', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Ghee', hsn: '0405', price: 100, qty: 1, gstRate: 12 },
    { name: 'Tea', hsn: '0902', price: 100, qty: 1, gstRate: 0 }
  ];
  assert.deepEqual(pricing.computeTotals(items, '').lines.map(function (line) {
    return line.tax;
  }), [5, 12, 0]);
  assert.deepEqual(invoice.computeInvoiceFigures({ items: items }).rows.map(function (row) {
    return row.lineTax;
  }), [5, 12, 0]);
});

test('invoice prints checkout figures and still warns when a stored total differs', function () {
  var order = checkoutFixture().order;
  var html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>₹157\.25/);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹2007\.25/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  order.total = 2000;
  html = invoice.render(order);
  assert.match(html, /Accountant Reconciliation Notice/);
  assert.match(html, /recorded total \(₹2000\.00\) by \+₹7\.25/);
});

test('reconciliation compares the stored checkout figures with the invoice figures', function () {
  var fixture = checkoutFixture();
  var result = reports.getGstReconciliation(fixture.db);
  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 1,
    date: '26/11/2026',
    customer: 'Walk-in',
    coupon: 'SAVE10',
    ledgerSubtotal: 2000,
    ledgerDiscount: 150,
    ledgerTax: 157.25,
    ledgerTotal: 2007.25,
    invoiceDiscount: 150,
    invoiceTax: 157.25,
    invoiceTotal: 2007.25,
    delta: 0,
    matched: true
  });
});

test('CURRENT BEHAVIOUR: a GST-only mismatch is reported but has no invoice warning', function () {
  var order = {
    items: [{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }],
    coupon: '',
    subtotal: 100,
    discount: 0,
    tax: 17,
    total: 118
  };
  var result = reports.getGstReconciliation({ orders: [order] });
  assert.equal(result.rows[0].invoiceTax, 18);
  assert.equal(result.rows[0].matched, false);
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalDelta, 0);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
