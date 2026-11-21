'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('order pricing applies HSN rates and coupon discount before GST', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 500, qty: 1 }
  ];

  assert.deepEqual(pricing.computeTotals(items, 'SAVE10'), {
    subtotal: 600,
    discount: 60,
    taxable: 540,
    tax: 85.5,
    cgst: 42.75,
    sgst: 42.75,
    total: 625.5,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 100, discount: 10, taxable: 90, tax: 4.5, net: 94.5 },
      { id: 2, name: 'Tea', hsn: '0902', gstPercent: 18, gross: 500, discount: 50, taxable: 450, tax: 81, net: 531 }
    ]
  });
});

test('invoice figures match billed order pricing for HSN slabs and coupon discount', function () {
  var order = {
    id: 1001,
    items: [
      { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
      { id: 2, name: 'Tea', hsn: '0902', price: 500, qty: 1 }
    ],
    coupon: 'SAVE10',
    total: 625.5
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, 600);
  assert.equal(figures.tax, 85.5);
  assert.equal(figures.cgst, 42.75);
  assert.equal(figures.sgst, 42.75);
  assert.equal(figures.discount, 60);
  assert.equal(figures.total, 625.5);
  assert.deepEqual(figures.rows.map(function (row) {
    return { hsn: row.hsn, gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), [
    { hsn: '1006', gstPercent: 5, lineTax: 4.5 },
    { hsn: '0902', gstPercent: 18, lineTax: 81 }
  ]);
  assert.doesNotMatch(invoice.render(order), /differs from Order Ledger recorded total/);
});

test('invoice percentage discount respects the billed coupon cap and is applied before GST', function () {
  var order = {
    items: [{ name: 'Goods', hsn: '0902', price: 2000, qty: 1 }],
    coupon: 'SAVE10'
  };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 2000,
    discount: 150,
    tax: 333,
    cgst: 166.5,
    sgst: 166.5,
    total: 2183,
    rows: [
      { name: 'Goods', sku: '-', hsn: '0902', qty: 1, price: 2000, gstPercent: 18, line: 2000, lineTax: 333 }
    ]
  });
});
