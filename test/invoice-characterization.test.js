var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function makeOrder(coupon, price) {
  var items = [{
    id: 1,
    sku: 'RICE-001',
    name: 'Rice',
    hsn: '1006',
    price: price || 100,
    qty: 2
  }];
  var totals = pricing.computeTotals(items, coupon || '');

  return {
    id: 1001,
    date: '28/11/2026',
    customer: 'In-memory customer',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('CURRENT BEHAVIOUR: order pricing applies the HSN rate after discount', function () {
  var order = makeOrder();
  var totals = pricing.computeTotals(order.items, order.coupon);

  assert.equal(totals.subtotal, 200);
  assert.equal(totals.discount, 0);
  assert.equal(totals.tax, 10);
  assert.equal(totals.cgst, 5);
  assert.equal(totals.sgst, 5);
  assert.equal(totals.total, 210);
});

test('invoice uses the same HSN tax rate and total as order pricing', function () {
  var order = makeOrder();
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 10);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.total, order.total);
});

test('invoice applies SAVE10 consistently with order pricing', function () {
  var order = makeOrder('SAVE10', 300);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 60);
  assert.equal(order.tax, 27);
  assert.equal(order.total, 567);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 27);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.total, order.total);
});

test('GST reconciliation matches invoice and order-ledger totals', function () {
  var order = makeOrder();
  var result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].ledgerTax, 10);
  assert.equal(result.rows[0].invoiceTax, 10);
  assert.equal(result.rows[0].ledgerTotal, 210);
  assert.equal(result.rows[0].invoiceTotal, 210);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});
