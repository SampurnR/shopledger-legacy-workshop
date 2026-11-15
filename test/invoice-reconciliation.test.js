var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function orderFor(item, coupon, totals) {
  return {
    id: 2001,
    date: '15/11/2026',
    customer: 'In-memory test customer',
    status: 'completed',
    paymentMode: 'cash',
    items: [item],
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice uses the same HSN GST and totals as order pricing', function () {
  // routes/orders.js snapshots HSN but does not store gstRate on order items.
  var item = { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 };
  var billed = pricing.computeTotals([item], '');
  var invoiceFigures = invoice.computeInvoiceFigures(orderFor(item, '', billed));

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
});

test('invoice applies percentage coupons before GST like order pricing', function () {
  var items = [
    { id: 2, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 3, name: 'Tea', hsn: '0902', price: 140, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, 'WELCOME');
  var order = orderFor(items[0], 'WELCOME', billed);
  order.items = items;
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
  assert.deepEqual(invoiceFigures.rows.map(function (row) { return row.gstPercent; }), [5, 18]);
  assert.deepEqual(invoiceFigures.rows.map(function (row) { return row.lineTax; }), billed.lines.map(function (line) { return line.tax; }));
});

test('invoice applies flat coupons before GST like order pricing', function () {
  var item = { id: 3, name: 'Item', hsn: '1006', price: 500, qty: 1 };
  var billed = pricing.computeTotals([item], 'FLAT50');
  var invoiceFigures = invoice.computeInvoiceFigures(orderFor(item, 'FLAT50', billed));

  assert.equal(billed.discount, 50);
  assert.equal(billed.tax, 22.5);
  assert.equal(billed.total, 472.5);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
});

test('reconciliation marks an order as matched when invoice and ledger totals agree', function () {
  var item = { id: 4, name: 'Item', hsn: '1006', gstRate: 5, price: 100, qty: 1 };
  var billed = pricing.computeTotals([item], 'WELCOME');
  var order = orderFor(item, 'WELCOME', billed);
  var result = reports.getGstReconciliation({
    products: [],
    customers: [],
    orders: [order]
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
  assert.equal(result.rows[0].ledgerTax, 4.75);
  assert.equal(result.rows[0].invoiceTax, 4.75);
});

test('printable invoice omits a reconciliation warning when totals agree', function () {
  var item = { id: 5, name: 'Rice', hsn: '1006', price: 100, qty: 1 };
  var billed = pricing.computeTotals([item], '');
  var html = invoice.render(orderFor(item, '', billed));

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
