'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function hsnRiceOrder(overrides) {
  return Object.assign({
    id: 7001,
    date: '01/04/2022',
    customer: 'Test Customer',
    paymentMode: 'cash',
    status: 'completed',
    coupon: '',
    items: [
      {
        id: 1,
        sku: 'RICE-TEST',
        name: 'Test Rice',
        hsn: '1006',
        price: 100,
        qty: 2
      }
    ]
  }, overrides || {});
}

test('invoice totals and GST breakdown match the order calculation used for billing', function () {
  var item = {
    id: 2,
    sku: 'RICE-TEST',
    name: 'Test Rice',
    hsn: '1006',
    price: 1000,
    qty: 1
  };
  var billed = pricing.computeTotals([item], 'SAVE10');
  var printed = invoice.computeInvoiceFigures(hsnRiceOrder({
    coupon: 'SAVE10',
    items: [item],
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  }));

  assert.deepEqual({
    subtotal: printed.subtotal,
    discount: printed.discount,
    tax: printed.tax,
    cgst: printed.cgst,
    sgst: printed.sgst,
    total: printed.total,
    gstPercent: printed.rows[0].gstPercent,
    lineTax: printed.rows[0].lineTax
  }, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total,
    gstPercent: 5,
    lineTax: 45
  });
});

test('pricing calculates order tax using the configured HSN slab', function () {
  var order = hsnRiceOrder();
  var totals = pricing.computeTotals(order.items, '');

  assert.deepEqual({
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    tax: totals.tax,
    cgst: totals.cgst,
    sgst: totals.sgst,
    total: totals.total,
    line: totals.lines[0]
  }, {
    subtotal: 200,
    discount: 0,
    taxable: 200,
    tax: 10,
    cgst: 5,
    sgst: 5,
    total: 210,
    line: {
      id: 1,
      name: 'Test Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 200,
      discount: 0,
      taxable: 200,
      tax: 10,
      net: 210
    }
  });
});

test('invoice applies HSN slab to GST and splits tax consistently with billing', function () {
  var figures = invoice.computeInvoiceFigures(hsnRiceOrder());

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    row: figures.rows[0]
  }, {
    subtotal: 200,
    discount: 0,
    tax: 10,
    cgst: 5,
    sgst: 5,
    total: 210,
    row: {
      name: 'Test Rice',
      sku: 'RICE-TEST',
      hsn: '1006',
      qty: 2,
      price: 100,
      gstPercent: 5,
      line: 200,
      lineTax: 10
    }
  });
});

test('invoice applies a flat coupon and GST using the billing calculation', function () {
  var item = {
    id: 2,
    sku: 'RICE-TEST',
    name: 'Test Rice',
    hsn: '1006',
    price: 400,
    qty: 1
  };
  var billed = pricing.computeTotals([item], 'FLAT50');
  var printed = invoice.computeInvoiceFigures(hsnRiceOrder({
    coupon: 'FLAT50',
    items: [item]
  }));

  assert.deepEqual(
    { discount: printed.discount, tax: printed.tax, total: printed.total },
    { discount: billed.discount, tax: billed.tax, total: billed.total }
  );
  assert.deepEqual({ discount: printed.discount, tax: printed.tax, total: printed.total },
    { discount: 50, tax: 17.5, total: 367.5 });
});

test('invoice render omits reconciliation warning when the invoice matches the billed total', function () {
  var item = {
    id: 2,
    sku: 'RICE-TEST',
    name: 'Test Rice',
    hsn: '1006',
    price: 1000,
    qty: 1
  };
  var billed = pricing.computeTotals([item], 'SAVE10');
  var html = invoice.render(hsnRiceOrder({
    coupon: 'SAVE10',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total,
    items: [item]
  }));

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹945\.00/);
});

test('GST reconciliation reports matching invoice and order figures after the fix', function () {
  var item = {
    id: 1,
    sku: 'RICE-TEST',
    name: 'Test Rice',
    hsn: '1006',
    price: 100,
    qty: 2
  };
  var billed = pricing.computeTotals([item], '');
  var result = reports.getGstReconciliation({
    orders: [hsnRiceOrder({
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total,
      items: [item]
    })]
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].invoiceTax, 10);
  assert.equal(result.rows[0].ledgerTax, 10);
  assert.equal(result.rows[0].invoiceTotal, 210);
  assert.equal(result.rows[0].ledgerTotal, 210);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});

