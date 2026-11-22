'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('EXPECTED BEHAVIOUR: invoice GST breakdown and total match the billed pricing totals', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 500, qty: 1 }];
  var order = { items: items, coupon: 'SAVE10' };
  var ledgerTotals = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: ledgerTotals.subtotal, discount: ledgerTotals.discount, tax: ledgerTotals.tax, cgst: ledgerTotals.cgst, sgst: ledgerTotals.sgst, total: ledgerTotals.total, lineGstPercent: ledgerTotals.lines[0].gstPercent, lineTax: ledgerTotals.lines[0].tax },
    { subtotal: 500, discount: 50, tax: 22.5, cgst: 11.25, sgst: 11.25, total: 472.5, lineGstPercent: 5, lineTax: 22.5 }
  );
  assert.deepEqual(
    {
      subtotal: invoiceFigures.subtotal,
      discount: invoiceFigures.discount,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total,
      lineGstPercent: invoiceFigures.rows[0].gstPercent,
      lineTax: invoiceFigures.rows[0].lineTax
    },
    {
      subtotal: ledgerTotals.subtotal,
      discount: ledgerTotals.discount,
      tax: ledgerTotals.tax,
      cgst: ledgerTotals.cgst,
      sgst: ledgerTotals.sgst,
      total: ledgerTotals.total,
      lineGstPercent: ledgerTotals.lines[0].gstPercent,
      lineTax: ledgerTotals.lines[0].tax
    }
  );
});

test('CURRENT BEHAVIOUR: invoice uses the product HSN slab for GST', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 100, qty: 1 }];
  var order = { items: items, coupon: '' };

  var ledgerTotals = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: invoiceFigures.subtotal, tax: invoiceFigures.tax, cgst: invoiceFigures.cgst, sgst: invoiceFigures.sgst, total: invoiceFigures.total, lineGstPercent: invoiceFigures.rows[0].gstPercent, lineTax: invoiceFigures.rows[0].lineTax },
    { subtotal: ledgerTotals.subtotal, tax: ledgerTotals.tax, cgst: ledgerTotals.cgst, sgst: ledgerTotals.sgst, total: ledgerTotals.total, lineGstPercent: ledgerTotals.lines[0].gstPercent, lineTax: ledgerTotals.lines[0].tax }
  );
});

test('CURRENT BEHAVIOUR: invoice applies SAVE10 to discounted taxable pricing totals', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 500, qty: 1 }];
  var order = { items: items, coupon: 'SAVE10' };

  var ledgerTotals = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: invoiceFigures.subtotal, discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { subtotal: ledgerTotals.subtotal, discount: ledgerTotals.discount, tax: ledgerTotals.tax, total: ledgerTotals.total }
  );
});
