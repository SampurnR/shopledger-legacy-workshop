'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function makeBilledOrder() {
  var items = [
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 2 },
    { id: 2, name: 'Tea', sku: 'TEA-1', hsn: '0902', price: 50, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, 'WELCOME');

  return {
    id: 17,
    date: '2026-11-15',
    customer: 'Example Customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: 'WELCOME',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
}

test('CURRENT BEHAVIOUR: order pricing apportions coupon before applying each HSN GST slab', function () {
  var result = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { id: 2, name: 'Tea', hsn: '0902', price: 50, qty: 1 }
  ], 'WELCOME');

  assert.deepEqual({
    subtotal: result.subtotal,
    discount: result.discount,
    taxable: result.taxable,
    tax: result.tax,
    cgst: result.cgst,
    sgst: result.sgst,
    total: result.total,
    lineRates: result.lines.map(function (line) { return line.gstPercent; }),
    lineTaxes: result.lines.map(function (line) { return line.tax; })
  }, {
    subtotal: 250,
    discount: 12.5,
    taxable: 237.5,
    tax: 18.05,
    cgst: 9.03,
    sgst: 9.02,
    total: 255.55,
    lineRates: [5, 18],
    lineTaxes: [9.5, 8.55]
  });
});

test('Invoice uses the billed HSN slabs and apportioned coupon discount', function () {
  var order = makeBilledOrder();
  var result = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: result.subtotal,
    discount: result.discount,
    tax: result.tax,
    cgst: result.cgst,
    sgst: result.sgst,
    total: result.total,
    lineRates: result.rows.map(function (row) { return row.gstPercent; }),
    lineTaxes: result.rows.map(function (row) { return row.lineTax; })
  }, {
    subtotal: 250,
    discount: 12.5,
    tax: 18.05,
    cgst: 9.03,
    sgst: 9.02,
    total: 255.55,
    lineRates: [5, 18],
    lineTaxes: [9.5, 8.55]
  });
});

test('Reconciliation reports the billed invoice figures as matched', function () {
  var order = makeBilledOrder();
  var result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 17,
    date: '2026-11-15',
    customer: 'Example Customer',
    coupon: 'WELCOME',
    ledgerSubtotal: 250,
    ledgerDiscount: 12.5,
    ledgerTax: 18.05,
    ledgerTotal: 255.55,
    invoiceDiscount: 12.5,
    invoiceTax: 18.05,
    invoiceTotal: 255.55,
    delta: 0,
    matched: true
  });
});

test('Invoice figures match the totals charged by order pricing', function () {
  var order = makeBilledOrder();
  var result = invoice.computeInvoiceFigures(order);

  assert.equal(result.subtotal, order.subtotal);
  assert.equal(result.discount, order.discount);
  assert.equal(result.tax, order.tax);
  assert.equal(result.total, order.total);
});
