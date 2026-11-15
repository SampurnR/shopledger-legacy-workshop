var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function orderFromPricing(id, items, coupon) {
  var totals = pricing.computeTotals(items, coupon);
  return {
    id: id,
    date: '15/11/2026',
    customer: 'In-memory customer',
    status: 'completed',
    paymentMode: 'cash',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice uses the billed HSN GST, coupon allocation, and total', function () {
  var order = orderFromPricing(500, [
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 640, qty: 1 },
    { id: 8, name: 'Tea', sku: 'TEA', hsn: '0902', price: 140, qty: 1 }
  ], 'SAVE10');

  var billed = pricing.computeTotals(order.items, order.coupon);
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceFigures.subtotal, billed.subtotal);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
  assert.deepEqual(invoiceFigures.rows.map(function (row) {
    return { hsn: row.hsn, gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), billed.lines.map(function (line) {
    return { hsn: line.hsn, gstPercent: line.gstPercent, lineTax: line.tax };
  }));
  assert.match(invoice.render(order), /₹753\.48/);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice applies product HSN GST slabs when gstRate is absent', function () {
  var order = orderFromPricing(501, [
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Tea', sku: 'TEA', hsn: '0902', price: 100, qty: 1 }
  ], '');

  var billed = pricing.computeTotals(order.items, '');
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.tax, 23);
  assert.equal(billed.total, 223);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.rows[1].gstPercent, 18);
  assert.equal(invoiceFigures.tax, 23);
  assert.equal(invoiceFigures.cgst, 11.5);
  assert.equal(invoiceFigures.sgst, 11.5);
  assert.equal(invoiceFigures.total, 223);
});

test('invoice applies percentage coupon to subtotal before calculating GST', function () {
  var items = [{ id: 2, name: 'Tea', sku: 'TEA', hsn: '0902', price: 1000, qty: 1 }];
  var order = orderFromPricing(502, items, 'SAVE10');

  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 100);
  assert.equal(billed.tax, 162);
  assert.equal(billed.total, 1062);
  assert.equal(invoiceFigures.discount, 100);
  assert.equal(invoiceFigures.tax, 162);
  assert.equal(invoiceFigures.total, 1062);
  assert.equal(invoiceFigures.tax, billed.tax);
});

test('reconciliation reports matching figures and excludes cancelled orders', function () {
  var activeOrder = orderFromPricing(503, [
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 500, qty: 1 },
    { id: 2, name: 'Tea', sku: 'TEA', hsn: '0902', price: 500, qty: 1 }
  ], 'SAVE10');
  var cancelledOrder = orderFromPricing(504, [
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }
  ], '');
  cancelledOrder.status = 'cancelled';

  var result = reports.getGstReconciliation({
    orders: [activeOrder, cancelledOrder],
    products: [],
    customers: []
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].orderId, 503);
  assert.equal(result.rows[0].ledgerDiscount, 100);
  assert.equal(result.rows[0].invoiceDiscount, 100);
  assert.equal(result.rows[0].ledgerTax, 103.5);
  assert.equal(result.rows[0].invoiceTax, 103.5);
  assert.equal(result.rows[0].ledgerTotal, 1003.5);
  assert.equal(result.rows[0].invoiceTotal, 1003.5);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].matched, true);
});
