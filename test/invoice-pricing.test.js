'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

// All fixtures stay in memory and compare invoice figures with order pricing.
function makeOrder() {
  var items = [{
    id: 1,
    sku: 'RICE-1',
    name: 'Rice',
    hsn: '1006',
    price: 3000,
    qty: 1
  }];
  var totals = pricing.computeTotals(items, 'WELCOME');

  return {
    id: 1001,
    date: '22/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: 'WELCOME',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('CORRECT BEHAVIOUR: invoice figures match the amounts charged to the customer', function () {
  var order = makeOrder();
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    gstPercent: figures.rows[0].gstPercent
  }, {
    subtotal: order.subtotal,
    discount: order.discount,
    tax: order.tax,
    cgst: 72.5,
    sgst: 72.5,
    total: order.total,
    gstPercent: 5
  });
});

test('CURRENT BEHAVIOUR: order pricing uses the HSN slab and applies capped discount before GST', function () {
  var order = makeOrder();
  var totals = pricing.computeTotals(order.items, order.coupon);

  assert.deepEqual({
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    tax: totals.tax,
    cgst: totals.cgst,
    sgst: totals.sgst,
    total: totals.total,
    gstPercent: totals.lines[0].gstPercent
  }, {
    subtotal: 3000,
    discount: 100,
    taxable: 2900,
    tax: 145,
    cgst: 72.5,
    sgst: 72.5,
    total: 3045,
    gstPercent: 5
  });
});

test('GST reconciliation matches the in-memory order pricing figures', function () {
  var result = reports.getGstReconciliation({ orders: [makeOrder()] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual({
    ledgerTax: result.rows[0].ledgerTax,
    invoiceTax: result.rows[0].invoiceTax,
    ledgerTotal: result.rows[0].ledgerTotal,
    invoiceTotal: result.rows[0].invoiceTotal,
    delta: result.rows[0].delta,
    matched: result.rows[0].matched
  }, {
    ledgerTax: 145,
    invoiceTax: 145,
    ledgerTotal: 3045,
    invoiceTotal: 3045,
    delta: 0,
    matched: true
  });
});

test('rendered invoice shows separate CGST and SGST lines and no mismatch notice', function () {
  var html = invoice.render(makeOrder());

  assert.match(html, /<tr><td>CGST<\/td><td class="r">₹72\.50<\/td><\/tr>/);
  assert.match(html, /<tr><td>SGST<\/td><td class="r">₹72\.50<\/td><\/tr>/);
  assert.doesNotMatch(html, /CGST \+ SGST \(Total GST\)/);
  assert.match(html, /<tr class="grand"><td>Invoice Total<\/td><td class="r">₹3045\.00<\/td><\/tr>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
