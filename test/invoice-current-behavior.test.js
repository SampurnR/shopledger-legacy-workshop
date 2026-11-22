var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function exampleItems() {
  return [
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, name: 'Ghee', sku: 'GHEE-1', hsn: '0405', price: 500, qty: 1 }
  ];
}

function exampleOrder() {
  var items = exampleItems();
  var totals = pricing.computeTotals(items, 'SAVE10');

  return {
    id: 42,
    date: '21/11/2026',
    customer: 'Example customer',
    paymentMode: 'cash',
    status: 'completed',
    coupon: 'SAVE10',
    items: items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('pricing applies capped coupon to subtotal, then HSN GST to discounted lines', function () {
  var totals = pricing.computeTotals(exampleItems(), 'SAVE10');

  assert.equal(totals.subtotal, 1500);
  assert.equal(totals.discount, 150);
  assert.equal(totals.lines[0].taxable, 900);
  assert.equal(totals.lines[0].gstPercent, 5);
  assert.equal(totals.lines[0].tax, 45);
  assert.equal(totals.lines[1].taxable, 450);
  assert.equal(totals.lines[1].gstPercent, 12);
  assert.equal(totals.lines[1].tax, 54);
  assert.equal(totals.tax, 99);
  assert.equal(totals.cgst, 49.5);
  assert.equal(totals.sgst, 49.5);
  assert.equal(totals.total, 1449);
});

test('invoice applies configured HSN GST rates', function () {
  var figures = invoice.computeInvoiceFigures({ items: exampleItems(), coupon: '' });

  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [5, 12]);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [50, 60]);
  assert.equal(figures.tax, 110);
  assert.equal(figures.cgst, 55);
  assert.equal(figures.sgst, 55);
});

test('invoice uses the configured coupon cap and pricing total', function () {
  var figures = invoice.computeInvoiceFigures({ items: exampleItems(), coupon: 'SAVE10' });

  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 99);
  assert.equal(figures.cgst, 49.5);
  assert.equal(figures.sgst, 49.5);
  assert.equal(figures.total, 1449);
});

test('invoice GST and total match the amount saved by pricing', function () {
  var order = exampleOrder();
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 99);
  assert.equal(order.total, 1449);
  assert.equal(invoiceFigures.tax, 99);
  assert.equal(invoiceFigures.total, 1449);
  assert.equal(invoiceFigures.tax - order.tax, 0);
  assert.equal(invoiceFigures.total - order.total, 0);
});

test('reconciliation reports no variance for an in-memory order when invoice matches pricing', function () {
  var order = exampleOrder();
  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].ledgerTax, 99);
  assert.equal(reconciliation.rows[0].invoiceTax, 99);
  assert.equal(reconciliation.rows[0].ledgerTotal, 1449);
  assert.equal(reconciliation.rows[0].invoiceTotal, 1449);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});

test('rendered invoice displays matching total without a reconciliation warning', function () {
  var html = invoice.render(exampleOrder());

  assert.match(html, /₹99\.00/);
  assert.match(html, /₹1449\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
