'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('CURRENT BEHAVIOUR: order pricing applies HSN slabs and coupon before GST', function () {
  var items = [
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 },
    { id: 2, name: 'Ghee', sku: 'GHEE-1', hsn: '0405', price: 450, qty: 1 }
  ];

  assert.deepEqual(pricing.computeTotals(items, 'SAVE10'), {
    subtotal: 1090,
    discount: 109,
    taxable: 981,
    tax: 77.4,
    cgst: 38.7,
    sgst: 38.7,
    total: 1058.4,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 640, discount: 64, taxable: 576, tax: 28.8, net: 604.8 },
      { id: 2, name: 'Ghee', hsn: '0405', gstPercent: 12, gross: 450, discount: 45, taxable: 405, tax: 48.6, net: 453.6 }
    ]
  });
});

test('invoice uses order pricing HSN slabs and applies coupon before GST', function () {
  var order = {
    id: 1001,
    coupon: 'SAVE10',
    items: [
      { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 },
      { id: 2, name: 'Ghee', sku: 'GHEE-1', hsn: '0405', price: 450, qty: 1 }
    ]
  };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 1090,
    discount: 109,
    tax: 77.4,
    cgst: 38.7,
    sgst: 38.7,
    total: 1058.4,
    rows: [
      { name: 'Rice', sku: 'RICE-1', hsn: '1006', qty: 1, price: 640, gstPercent: 5, line: 640, lineTax: 28.8 },
      { name: 'Ghee', sku: 'GHEE-1', hsn: '0405', qty: 1, price: 450, gstPercent: 12, line: 450, lineTax: 48.6 }
    ]
  });
});

test('reconciliation matches invoice figures to the order ledger', function () {
  var order = {
    id: 1001,
    date: '22/11/2026',
    customer: 'Walk-in',
    coupon: 'SAVE10',
    status: 'completed',
    subtotal: 1090,
    discount: 109,
    tax: 77.4,
    total: 1058.4,
    items: [
      { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 },
      { id: 2, name: 'Ghee', sku: 'GHEE-1', hsn: '0405', price: 450, qty: 1 }
    ]
  };

  var result = reports.getGstReconciliation({ orders: [order] });
  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 1001,
    date: '22/11/2026',
    customer: 'Walk-in',
    coupon: 'SAVE10',
    ledgerSubtotal: 1090,
    ledgerDiscount: 109,
    ledgerTax: 77.4,
    ledgerTotal: 1058.4,
    invoiceDiscount: 109,
    invoiceTax: 77.4,
    invoiceTotal: 1058.4,
    delta: 0,
    matched: true
  });
});

test('invoice interprets decimal gstRate the same way as order pricing', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Decimal rate item', price: 100, qty: 1, gstRate: 0.05 }]
  });

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
});

test('invoice figures match the order billed total and GST breakdown', function () {
  var items = [
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 },
    { id: 2, name: 'Ghee', sku: 'GHEE-1', hsn: '0405', price: 450, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var figures = invoice.computeInvoiceFigures({
    items: items,
    coupon: 'SAVE10',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });

  assert.equal(figures.subtotal, billed.subtotal);
  assert.equal(figures.discount, billed.discount);
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.cgst, billed.cgst);
  assert.equal(figures.sgst, billed.sgst);
  assert.equal(figures.total, billed.total);
  assert.deepEqual(figures.rows.map(function (row) {
    return { gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), billed.lines.map(function (line) {
    return { gstPercent: line.gstPercent, lineTax: line.tax };
  }));

  var html = invoice.render({
    id: 1001,
    items: items,
    coupon: 'SAVE10',
    total: billed.total
  });
  assert.match(html, /<td>CGST<\/td>/);
  assert.match(html, /<td>SGST<\/td>/);
});
