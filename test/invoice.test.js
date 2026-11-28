'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice matches the customer billed total and GST breakdown', function () {
  var items = [{ name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];
  var totals = pricing.computeTotals(items, 'WELCOME');
  var invoiceFigures = invoice.computeInvoiceFigures({
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total,
    coupon: 'WELCOME',
    items: items
  });

  assert.equal(invoiceFigures.tax, totals.tax);
  assert.equal(invoiceFigures.total, totals.total);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.rows[0].lineTax, 47.5);
});

test('CURRENT BEHAVIOUR: ledger applies HSN GST to post-discount taxable value', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ];

  assert.deepEqual(pricing.computeTotals(items, ''), {
    subtotal: 200,
    discount: 0,
    taxable: 200,
    tax: 23,
    cgst: 11.5,
    sgst: 11.5,
    total: 223,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 100, discount: 0, taxable: 100, tax: 5, net: 105 },
      { id: 2, name: 'Tea', hsn: '0902', gstPercent: 18, gross: 100, discount: 0, taxable: 100, tax: 18, net: 118 }
    ]
  });
});

test('invoice uses the same HSN GST slabs as order pricing', function () {
  var order = {
    id: 7,
    items: [
      { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
      { name: 'Tea', hsn: '0902', price: 100, qty: 1 }
    ]
  };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 200,
    discount: 0,
    tax: 23,
    cgst: 11.5,
    sgst: 11.5,
    total: 223,
    rows: [
      { name: 'Rice', sku: '-', hsn: '1006', qty: 1, price: 100, gstPercent: 5, line: 100, lineTax: 5 },
      { name: 'Tea', sku: '-', hsn: '0902', qty: 1, price: 100, gstPercent: 18, line: 100, lineTax: 18 }
    ]
  });
});

test('invoice coupon discount and GST match order pricing', function () {
  var items = [{ id: 3, name: 'Goods', hsn: '1006', price: 1000, qty: 1 }];
  var ledgerFigures = pricing.computeTotals(items, 'WELCOME');
  var invoiceFigures = invoice.computeInvoiceFigures({
    id: 8,
    coupon: 'WELCOME',
    items: items
  });

  assert.deepEqual(ledgerFigures, {
    subtotal: 1000,
    discount: 50,
    taxable: 950,
    tax: 47.5,
    cgst: 23.75,
    sgst: 23.75,
    total: 997.5,
    lines: [{ id: 3, name: 'Goods', hsn: '1006', gstPercent: 5, gross: 1000, discount: 50, taxable: 950, tax: 47.5, net: 997.5 }]
  });
  assert.deepEqual(invoiceFigures, {
    subtotal: 1000,
    discount: 50,
    tax: 47.5,
    cgst: 23.75,
    sgst: 23.75,
    total: 997.5,
    rows: [{ name: 'Goods', sku: '-', hsn: '1006', qty: 1, price: 1000, gstPercent: 5, line: 1000, lineTax: 47.5 }]
  });
});

test('GST reconciliation shows matching figures for in-memory orders', function () {
  var items = [{ id: 4, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];
  var totals = pricing.computeTotals(items, 'WELCOME');
  var db = { orders: [{
    id: 9, date: '2026-11-28', customer: 'Customer', coupon: 'WELCOME',
    subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax,
    total: totals.total, items: items
  }] };

  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 9, date: '2026-11-28', customer: 'Customer', coupon: 'WELCOME',
      ledgerSubtotal: 1000, ledgerDiscount: 50, ledgerTax: 47.5, ledgerTotal: 997.5,
      invoiceDiscount: 50, invoiceTax: 47.5, invoiceTotal: 997.5, delta: 0, matched: true
    }]
  });
});
