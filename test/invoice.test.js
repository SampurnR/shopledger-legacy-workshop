'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');

var config = require('../config');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

function makeLedgerOrder(items, coupon) {
  var totals = pricing.computeTotals(items, coupon);
  return {
    id: 1,
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice uses the billed HSN GST slab and matches ledger tax and total', function () {
  var items = [{
    id: 1,
    sku: 'GRN-001',
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 1
  }];
  var order = makeLedgerOrder(items, '');
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      subtotal: figures.subtotal,
      tax: figures.tax,
      cgst: figures.cgst,
      sgst: figures.sgst,
      total: figures.total,
      rowGstPercent: figures.rows[0].gstPercent,
      rowTax: figures.rows[0].lineTax
    },
    {
      subtotal: order.subtotal,
      tax: order.tax,
      cgst: 2.5,
      sgst: 2.5,
      total: order.total,
      rowGstPercent: 5,
      rowTax: 5
    }
  );
});
test('invoice applies SAVE10 under the same cap and taxable-value rules as the ledger', function () {
  var items = [{
    id: 1,
    sku: 'GRN-001',
    name: 'Rice',
    hsn: '1006',
    price: 3000,
    qty: 1
  }];
  var order = makeLedgerOrder(items, 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      subtotal: figures.subtotal,
      discount: figures.discount,
      tax: figures.tax,
      cgst: figures.cgst,
      sgst: figures.sgst,
      total: figures.total,
      rowGstPercent: figures.rows[0].gstPercent,
      rowTax: figures.rows[0].lineTax
    },
    {
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      cgst: 71.25,
      sgst: 71.25,
      total: order.total,
      rowGstPercent: 5,
      rowTax: 142.5
    }
  );
});

test('invoice HTML shows the billed total and billed GST', function () {
  var items = [{
    id: 1,
    sku: 'GRN-001',
    name: 'Rice',
    hsn: '1006',
    price: 640,
    qty: 1
  }];
  var order = makeLedgerOrder(items, 'SAVE10');
  var html = invoice.render(order);

  assert.match(html, /CGST \+ SGST \(Total GST\).*?₹28\.80/);
  assert.match(html, /Invoice Total.*?₹604\.80/);
  assert.doesNotMatch(html, /Invoice computed total \(₹679\.68\)/);
});

test('invoice retains recorded GST and total if the configured HSN slab changes later', function () {
  var items = [{
    id: 1,
    sku: 'GRN-001',
    name: 'Rice',
    hsn: '1006',
    price: 3000,
    qty: 1
  }];
  var order = makeLedgerOrder(items, '');
  var previousRate = config.tax.hsnSlabs['1006'];
  var figures;

  try {
    config.tax.hsnSlabs['1006'] = 12;
    figures = invoice.computeInvoiceFigures(order);
  } finally {
    config.tax.hsnSlabs['1006'] = previousRate;
  }

  assert.deepEqual(
    {
      tax: figures.tax,
      cgst: figures.cgst,
      sgst: figures.sgst,
      total: figures.total,
      rowGstPercent: figures.rows[0].gstPercent,
      rowTax: figures.rows[0].lineTax
    },
    {
      tax: order.tax,
      cgst: order.tax / 2,
      sgst: order.tax / 2,
      total: order.total,
      rowGstPercent: 5,
      rowTax: order.tax
    }
  );
});
