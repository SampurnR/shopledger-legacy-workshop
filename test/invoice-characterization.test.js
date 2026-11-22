'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

// Mirrors the item shape assembled by routes/orders.js, using only in-memory data.
function makeOrder() {
  return {
    id: 1001,
    date: '2026-11-22',
    customer: 'Test Customer',
    paymentMode: 'cash',
    status: 'completed',
    coupon: 'SAVE10',
    items: [
      { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 300, qty: 2 }
    ]
  };
}

test('checkout applies the HSN slab and coupon to the subtotal before GST', function () {
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
    subtotal: 600,
    discount: 60,
    taxable: 540,
    tax: 27,
    cgst: 13.5,
    sgst: 13.5,
    total: 567,
    gstPercent: 5
  });
});

test('invoice figures match the totals used to bill the customer', function () {
  var order = makeOrder();
  var billed = pricing.computeTotals(order.items, order.coupon);
  order.subtotal = billed.subtotal;
  order.discount = billed.discount;
  order.tax = billed.tax;
  order.total = billed.total;
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    gstPercent: figures.rows[0].gstPercent,
    lineTax: figures.rows[0].lineTax
  }, {
    subtotal: 600,
    discount: 60,
    tax: 27,
    cgst: 13.5,
    sgst: 13.5,
    total: 567,
    gstPercent: 5,
    lineTax: 27
  });
});

test('invoice renders billed GST and total without a reconciliation warning', function () {
  var order = makeOrder();
  order.total = pricing.computeTotals(order.items, order.coupon).total;
  var html = invoice.render(order);

  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹27\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹567\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.doesNotMatch(html, /<td>CGST<\/td>|<td>SGST<\/td>/);
});

