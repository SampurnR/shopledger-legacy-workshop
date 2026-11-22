'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function sampleItems() {
  return [
    { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { id: 2, sku: 'GHEE-1', name: 'Ghee', hsn: '0405', price: 50, qty: 1 }
  ];
}

function sampleOrder() {
  var items = sampleItems();
  var totals = pricing.computeTotals(items, 'WELCOME');
  return {
    id: 1001,
    date: '22/11/2026',
    customer: 'Test customer',
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

test('CURRENT BEHAVIOUR: checkout applies HSN rates after proportionally apportioning coupon discount', function () {
  var totals = pricing.computeTotals(sampleItems(), 'WELCOME');

  assert.equal(totals.subtotal, 250);
  assert.equal(totals.discount, 12.5);
  assert.equal(totals.tax, 15.2);
  assert.equal(totals.cgst, 7.6);
  assert.equal(totals.sgst, 7.6);
  assert.equal(totals.total, 252.7);
  assert.deepEqual(totals.lines.map(function (line) {
    return { hsn: line.hsn, gstPercent: line.gstPercent, discount: line.discount, taxable: line.taxable, tax: line.tax };
  }), [
    { hsn: '1006', gstPercent: 5, discount: 10, taxable: 190, tax: 9.5 },
    { hsn: '0405', gstPercent: 12, discount: 2.5, taxable: 47.5, tax: 5.7 }
  ]);
});

test('invoice figures use the same HSN rates, discount allocation, and tax breakdown as checkout', function () {
  var result = invoice.computeInvoiceFigures(sampleOrder());

  assert.equal(result.subtotal, 250);
  assert.equal(result.tax, 15.2);
  assert.equal(result.cgst, 7.6);
  assert.equal(result.sgst, 7.6);
  assert.equal(result.discount, 12.5);
  assert.equal(result.total, 252.7);
  assert.deepEqual(result.rows.map(function (row) {
    return { hsn: row.hsn, gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), [
    { hsn: '1006', gstPercent: 5, lineTax: 9.5 },
    { hsn: '0405', gstPercent: 12, lineTax: 5.7 }
  ]);
});

test('invoice total and GST breakdown match the amount billed at checkout', function () {
  var order = sampleOrder();
  var result = invoice.computeInvoiceFigures(order);

  assert.equal(result.subtotal, order.subtotal);
  assert.equal(result.discount, order.discount);
  assert.equal(result.tax, order.tax);
  assert.equal(result.total, order.total);
  assert.equal(result.cgst, 7.6);
  assert.equal(result.sgst, 7.6);
});

test('invoice coupon discount follows checkout minimum and cap rules', function () {
  var belowMinimum = invoice.computeInvoiceFigures({
    items: [{ name: 'Item', price: 100, qty: 1 }], coupon: 'SAVE10'
  });
  var aboveCap = invoice.computeInvoiceFigures({
    items: [{ name: 'Item', price: 2000, qty: 1 }], coupon: 'SAVE10'
  });

  assert.equal(belowMinimum.discount, 0);
  assert.equal(belowMinimum.total, 118);
  assert.equal(aboveCap.discount, 150);
  assert.equal(aboveCap.total, 2183);
});

test('GST reconciliation reports checkout and invoice calculations as matched', function () {
  var order = sampleOrder();
  var result = reports.getGstReconciliation({
    orders: [order], products: [], customers: [], settlements: []
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].ledgerTax, 15.2);
  assert.equal(result.rows[0].invoiceTax, 15.2);
  assert.equal(result.rows[0].ledgerTotal, 252.7);
  assert.equal(result.rows[0].invoiceTotal, 252.7);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});
