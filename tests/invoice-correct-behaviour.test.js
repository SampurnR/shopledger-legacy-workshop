'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

test('invoice uses the HSN 1006 GST rate for rice', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }],
    coupon: ''
  });

  assert.deepEqual(
    {
      subtotal: figures.subtotal,
      tax: figures.tax,
      cgst: figures.cgst,
      sgst: figures.sgst,
      gstPercent: figures.rows[0].gstPercent,
      total: figures.total
    },
    { subtotal: 1000, tax: 50, cgst: 25, sgst: 25, gstPercent: 5, total: 1050 }
  );
});

test('invoice applies SAVE10 to groundnut oil using the order discount cap and HSN GST rate', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ id: 5, name: 'Groundnut Oil', sku: 'OIL-002', hsn: '1508', price: 1120, qty: 2 }],
    coupon: 'SAVE10'
  });

  assert.deepEqual(
    {
      subtotal: figures.subtotal,
      discount: figures.discount,
      tax: figures.tax,
      total: figures.total
    },
    { subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 }
  );
});
