'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function item(id, sku, name, hsn, price, qty) {
  return {
    id: id,
    sku: sku,
    name: name,
    hsn: hsn,
    price: price,
    qty: qty
  };
}

function order(items, coupon, totals) {
  return {
    id: 9001,
    date: '01/04/2022',
    customer: 'Test Customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

function totals(figures) {
  return {
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total
  };
}

test('invoice applies non-default HSN rates to line GST and totals', function () {
  var items = [
    item(1, 'GRN-001', 'Rice', '1006', 640, 1),
    item(6, 'DRY-001', 'Ghee', '0405', 450, 1)
  ];
  var expected = {
    subtotal: 1090,
    discount: 0,
    tax: 86,
    cgst: 43,
    sgst: 43,
    total: 1176
  };
  var figures = invoice.computeInvoiceFigures(order(items, '', expected));

  assert.deepEqual(totals(figures), expected);
  assert.deepEqual(
    figures.rows.map(function (row) {
      return { gstPercent: row.gstPercent, lineTax: row.lineTax };
    }),
    [
      { gstPercent: 5, lineTax: 32 },
      { gstPercent: 12, lineTax: 54 }
    ]
  );
  assert.deepEqual(totals(figures), totals(pricing.computeTotals(items, '')));
});

test('invoice applies an eligible coupon using checkout coupon rules', function () {
  var items = [
    item(1, 'GRN-001', 'Rice', '1006', 640, 1),
    item(4, 'OIL-001', 'Sunflower Oil', '1512', 190, 2)
  ];
  var expected = {
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9
  };
  var figures = invoice.computeInvoiceFigures(order(items, 'SAVE10', expected));

  assert.deepEqual(totals(figures), expected);
  assert.deepEqual(
    figures.rows.map(function (row) {
      return row.lineTax;
    }),
    [28.8, 17.1]
  );
  assert.deepEqual(totals(figures), totals(pricing.computeTotals(items, 'SAVE10')));
});

test('invoice does not apply an inactive coupon', function () {
  var items = [
    item(12, 'BEV-003', 'Kokum Sherbet', '2106', 1500, 1)
  ];
  var expected = {
    subtotal: 1500,
    discount: 0,
    tax: 270,
    cgst: 135,
    sgst: 135,
    total: 1770
  };
  var figures = invoice.computeInvoiceFigures(order(items, 'DIWALI20', expected));

  assert.deepEqual(totals(figures), expected);
  assert.deepEqual(totals(figures), totals(pricing.computeTotals(items, '')));
});

test('invoice does not apply a coupon below its minimum-order threshold', function () {
  var items = [
    item(12, 'BEV-003', 'Kokum Sherbet', '2106', 400, 1)
  ];
  var expected = {
    subtotal: 400,
    discount: 0,
    tax: 72,
    cgst: 36,
    sgst: 36,
    total: 472
  };
  var figures = invoice.computeInvoiceFigures(order(items, 'SAVE10', expected));

  assert.deepEqual(totals(figures), expected);
  assert.deepEqual(totals(figures), totals(pricing.computeTotals(items, '')));
});

test('invoice respects a coupon maximum-discount cap', function () {
  var items = [
    item(5, 'OIL-002', 'Groundnut Oil', '1508', 2240, 1)
  ];
  var expected = {
    subtotal: 2240,
    discount: 150,
    tax: 104.5,
    cgst: 52.25,
    sgst: 52.25,
    total: 2194.5
  };
  var figures = invoice.computeInvoiceFigures(order(items, 'SAVE10', expected));

  assert.deepEqual(totals(figures), expected);
  assert.deepEqual(totals(figures), totals(pricing.computeTotals(items, 'SAVE10')));
});

test('invoice matches checkout for an order without a coupon', function () {
  var items = [
    item(8, 'BEV-001', 'Assam Tea', '0902', 140, 2),
    item(2, 'GRN-002', 'Toor Dal', '0713', 165, 2)
  ];
  var expected = {
    subtotal: 610,
    discount: 0,
    tax: 66.9,
    cgst: 33.45,
    sgst: 33.45,
    total: 676.9
  };
  var figures = invoice.computeInvoiceFigures(order(items, '', expected));

  assert.deepEqual(totals(figures), expected);
  assert.deepEqual(totals(figures), totals(pricing.computeTotals(items, '')));
});

test('GST reconciliation reports no discrepancy when invoice and checkout agree', function () {
  var items = [
    item(5, 'OIL-002', 'Groundnut Oil', '1508', 1120, 2)
  ];
  var storedTotals = {
    subtotal: 2240,
    discount: 150,
    tax: 104.5,
    cgst: 52.25,
    sgst: 52.25,
    total: 2194.5
  };
  var reconciliation = reports.getGstReconciliation({
    orders: [order(items, 'SAVE10', storedTotals)]
  });

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
