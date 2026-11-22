'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('pricing uses HSN GST and caps SAVE10 discount', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }
  ];

  assert.deepEqual(pricing.computeTotals(items, 'SAVE10'), {
    subtotal: 2000,
    discount: 150,
    taxable: 1850,
    tax: 92.5,
    cgst: 46.25,
    sgst: 46.25,
    total: 1942.5,
    lines: [
      {
        id: 1,
        name: 'Rice',
        hsn: '1006',
        gstPercent: 5,
        gross: 2000,
        discount: 150,
        taxable: 1850,
        tax: 92.5,
        net: 1942.5
      }
    ]
  });
});

test('invoice totals and GST match pricing for an HSN item with SAVE10', function () {
  var order = {
    coupon: 'SAVE10',
    items: [
      { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 2000, qty: 1 }
    ]
  };
  var billed = pricing.computeTotals(order.items, order.coupon);
  var invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(invoiced.subtotal, billed.subtotal);
  assert.equal(invoiced.discount, billed.discount);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.cgst, billed.cgst);
  assert.equal(invoiced.sgst, billed.sgst);
  assert.equal(invoiced.total, billed.total);
  assert.equal(invoiced.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(invoiced.rows[0].lineTax, billed.lines[0].tax);
});

test('invoice uses an explicit gstRate percentage when present', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [
      { name: 'Rice', hsn: '1006', gstRate: 12, price: 100, qty: 1 }
    ]
  });

  assert.equal(figures.rows[0].gstPercent, 12);
  assert.equal(figures.tax, 12);
  assert.equal(figures.total, 112);
});
