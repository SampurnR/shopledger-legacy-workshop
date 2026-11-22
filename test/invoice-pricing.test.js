var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('CURRENT BEHAVIOUR: order pricing applies the HSN slab and capped coupon to pre-tax subtotal', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 3000, qty: 1 }];
  var totals = pricing.computeTotals(items, 'SAVE10');

  assert.equal(totals.subtotal, 3000);
  assert.equal(totals.discount, 150);
  assert.equal(totals.tax, 142.5);
  assert.equal(totals.cgst, 71.25);
  assert.equal(totals.sgst, 71.25);
  assert.equal(totals.total, 2992.5);
  assert.deepEqual(totals.lines[0], {
    id: 1,
    name: 'Rice',
    hsn: '1006',
    gstPercent: 5,
    gross: 3000,
    discount: 150,
    taxable: 2850,
    tax: 142.5,
    net: 2992.5
  });
});

test('invoice uses the billed HSN slab and capped pre-tax coupon discount', function () {
  var order = {
    id: 1001,
    coupon: 'SAVE10',
    items: [{ id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 3000, qty: 1 }]
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, 3000);
  assert.equal(figures.tax, 142.5);
  assert.equal(figures.discount, 150);
  assert.equal(figures.total, 2992.5);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 142.5);
});

test('GST reconciliation matches the in-memory order figures shown to the customer', function () {
  var items = [{ id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 3000, qty: 1 }];
  var totals = pricing.computeTotals(items, 'SAVE10');
  var db = {
    products: [],
    customers: [],
    orders: [{
      id: 1001,
      date: '22/11/2026',
      customer: 'Walk-in',
      coupon: 'SAVE10',
      items: items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total
    }]
  };

  var reconciliation = reports.getGstReconciliation(db);

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].ledgerTax, 142.5);
  assert.equal(reconciliation.rows[0].invoiceTax, 142.5);
  assert.equal(reconciliation.rows[0].ledgerTotal, 2992.5);
  assert.equal(reconciliation.rows[0].invoiceTotal, 2992.5);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
