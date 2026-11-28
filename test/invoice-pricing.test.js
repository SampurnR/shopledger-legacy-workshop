'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('CURRENT BEHAVIOUR: billed order pricing applies the HSN slab before tax', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];

  var billed = pricing.computeTotals(items, '');

  assert.deepEqual({
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total,
    line: billed.lines[0]
  }, {
    subtotal: 1000,
    discount: 0,
    tax: 50,
    cgst: 25,
    sgst: 25,
    total: 1050,
    line: {
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 1000,
      discount: 0,
      taxable: 1000,
      tax: 50,
      net: 1050
    }
  });
});

test('invoice uses the billed HSN slab and matches the order GST breakdown', function () {
  // This is the shape created by routes/orders.js: it stores hsn but not gstRate.
  var order = {
    id: 1001,
    coupon: '',
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }],
    subtotal: 1000,
    discount: 0,
    tax: 50,
    total: 1050
  };

  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.rows[0].lineTax, 50);
  assert.equal(invoiceFigures.tax, order.tax);
  assert.equal(invoiceFigures.cgst, 25);
  assert.equal(invoiceFigures.sgst, 25);
  assert.equal(invoiceFigures.total, order.total);
});

test('invoice uses the same capped SAVE10 discount and taxable basis as the billed order', function () {
  var items = [{ id: 2, name: 'Tea', hsn: '0902', price: 2000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var order = {
    id: 1002,
    coupon: 'SAVE10',
    items: items,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };

  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 150); // SAVE10 maximum discount
  assert.equal(billed.tax, 333); // 18% applied after the capped discount
  assert.equal(billed.total, 2183);
  assert.equal(invoiceFigures.rows[0].gstPercent, 18);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
});

test('GST reconciliation matches the order figures for the invoice calculation', function () {
  var order = {
    id: 1003,
    date: '01/01/2022',
    customer: 'In-memory customer',
    coupon: '',
    items: [{ id: 3, name: 'Dal', hsn: '0713', price: 1000, qty: 1 }],
    subtotal: 1000,
    discount: 0,
    tax: 50,
    total: 1050
  };

  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].ledgerTax, 50);
  assert.equal(reconciliation.rows[0].invoiceTax, 50);
  assert.equal(reconciliation.rows[0].invoiceTotal, 1050);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
