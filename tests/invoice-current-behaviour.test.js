var assert = require('node:assert/strict');
var test = require('node:test');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function makeCurrentOrder() {
  var items = [{
    id: 1,
    sku: 'GRN-001',
    name: 'Rice',
    hsn: '1006',
    price: 2000,
    qty: 1
  }];
  var totals = pricing.computeTotals(items, 'SAVE10');

  return {
    id: 1001,
    date: '15/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: 'SAVE10',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('CURRENT BEHAVIOUR: order pricing uses HSN GST after discount and caps SAVE10', function () {
  var order = makeCurrentOrder();
  var totals = pricing.computeTotals(order.items, order.coupon);

  assert.deepStrictEqual({
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    tax: totals.tax,
    cgst: totals.cgst,
    sgst: totals.sgst,
    total: totals.total,
    gstPercent: totals.lines[0].gstPercent
  }, {
    subtotal: 2000,
    discount: 150,
    taxable: 1850,
    tax: 92.5,
    cgst: 46.25,
    sgst: 46.25,
    total: 1942.5,
    gstPercent: 5
  });
});

test('Invoice figures use order pricing HSN tax and coupon rules', function () {
  var result = invoice.computeInvoiceFigures(makeCurrentOrder());

  assert.deepStrictEqual({
    subtotal: result.subtotal,
    discount: result.discount,
    tax: result.tax,
    cgst: result.cgst,
    sgst: result.sgst,
    total: result.total,
    gstPercent: result.rows[0].gstPercent,
    lineTax: result.rows[0].lineTax
  }, {
    subtotal: 2000,
    discount: 150,
    tax: 92.5,
    cgst: 46.25,
    sgst: 46.25,
    total: 1942.5,
    gstPercent: 5,
    lineTax: 92.5
  });
});

test('GST reconciliation reports matching invoice and ledger figures', function () {
  var order = makeCurrentOrder();
  var result = reports.getGstReconciliation({ orders: [order] });

  assert.strictEqual(order.total, 1942.5);
  assert.strictEqual(order.tax, 92.5);
  assert.strictEqual(result.totalChecked, 1);
  assert.strictEqual(result.mismatchCount, 0);
  assert.strictEqual(result.rows[0].invoiceDiscount, order.discount);
  assert.strictEqual(result.rows[0].invoiceTax, order.tax);
  assert.strictEqual(result.rows[0].invoiceTotal, order.total);
  assert.strictEqual(result.rows[0].delta, 0);
  assert.strictEqual(result.rows[0].matched, true);
});
