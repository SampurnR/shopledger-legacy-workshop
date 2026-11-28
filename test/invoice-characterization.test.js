'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');

function mixedSlabItems() {
  return [
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 200, qty: 1 },
    { id: 2, sku: 'TEA', name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ];
}

test('billing uses HSN GST slabs and records post-discount totals', function () {
  var totals = pricing.computeTotals(mixedSlabItems(), '');

  assert.deepEqual(totals, {
    subtotal: 300,
    discount: 0,
    taxable: 300,
    tax: 28,
    cgst: 14,
    sgst: 14,
    total: 328,
    lines: [
      {
        id: 1,
        name: 'Rice',
        hsn: '1006',
        gstPercent: 5,
        gross: 200,
        discount: 0,
        taxable: 200,
        tax: 10,
        net: 210
      },
      {
        id: 2,
        name: 'Tea',
        hsn: '0902',
        gstPercent: 18,
        gross: 100,
        discount: 0,
        taxable: 100,
        tax: 18,
        net: 118
      }
    ]
  });
});

test('order creation preserves the billed figures in memory', function () {
  var db = { nextOrderId: 1001, orders: [] };
  var items = mixedSlabItems();
  var totals = pricing.computeTotals(items, '');
  var order = orders.add(db, {
    items: items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });

  assert.equal(order.id, 1001);
  assert.equal(order.tax, 28);
  assert.equal(order.total, 328);
  assert.equal(db.orders[0], order);
  assert.equal(db.nextOrderId, 1002);
});

test('invoice uses the billed GST breakdown, discount, and total', function () {
  var db = { nextOrderId: 1001, orders: [] };
  var items = [
    { id: 1, sku: 'RICE', name: 'Rice cases', hsn: '1006', price: 640, qty: 3 },
    { id: 2, sku: 'TEA', name: 'Tea', hsn: '0902', price: 140, qty: 1 }
  ];
  var totals = pricing.computeTotals(items, 'SAVE10');
  var order = orders.add(db, {
    items: items,
    coupon: 'SAVE10',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
  var printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      subtotal: printed.subtotal,
      discount: printed.discount,
      tax: printed.tax,
      cgst: printed.cgst,
      sgst: printed.sgst,
      total: printed.total
    },
    {
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      cgst: totals.cgst,
      sgst: totals.sgst,
      total: totals.total
    }
  );
  assert.deepEqual(
    printed.rows.map(function (row) { return row.gstPercent; }),
    [5, 18]
  );
});

test('invoice uses HSN slabs when line items omit gstRate', function () {
  var items = mixedSlabItems();
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(billed.tax, 28);
  assert.equal(billed.total, 328);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, 28);
  assert.equal(printed.total, 328);
});

test('invoice applies the SAVE10 cap and taxes the post-discount amount', function () {
  var items = [
    { id: 3, sku: 'TEA-CASE', name: 'Tea case', hsn: '0902', price: 2000, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual(
    { discount: billed.discount, tax: billed.tax, total: billed.total },
    { discount: 150, tax: 333, total: 2183 }
  );
  assert.deepEqual(
    { discount: printed.discount, tax: printed.tax, total: printed.total },
    { discount: 150, tax: 333, total: 2183 }
  );
});

test('rendered invoice omits the reconciliation warning when figures match', function () {
  var items = mixedSlabItems();
  var billed = pricing.computeTotals(items, '');
  var html = invoice.render({
    id: 1001,
    date: '2021-11-30',
    customer: 'In-memory Customer',
    paymentMode: 'cash',
    status: 'completed',
    coupon: '',
    items: items,
    total: billed.total
  });

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
  assert.match(html, /Invoice Total.*328\.00/);
});
