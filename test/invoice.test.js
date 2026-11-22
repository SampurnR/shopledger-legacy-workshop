'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

function item(id, name, hsn, price, qty) {
  return {
    id: id,
    sku: 'SKU-' + id,
    name: name,
    hsn: hsn,
    price: price,
    qty: qty
  };
}

function order(id, coupon, items, total) {
  return { id: id, coupon: coupon, items: items, total: total };
}

function figures(fixture) {
  var actual = invoice.computeInvoiceFigures(fixture);
  return {
    subtotal: actual.subtotal,
    discount: actual.discount,
    taxable: actual.taxable,
    tax: actual.tax,
    cgst: actual.cgst,
    sgst: actual.sgst,
    total: actual.total,
    rows: actual.rows.map(function (row) {
      return {
        gstPercent: row.gstPercent,
        line: row.line,
        discount: row.discount,
        taxable: row.taxable,
        lineTax: row.lineTax,
        net: row.net
      };
    })
  };
}

test('invoice uses checkout SAVE10 discount and HSN rate for order 1002', function () {
  var fixture = order(1002, 'SAVE10', [
    item(1, 'Indrayani Basmati Rice', '1006', 640, 1),
    item(4, 'Sunflower Oil', '1512', 190, 2)
  ], 963.9);

  assert.deepEqual(figures(fixture), {
    subtotal: 1020,
    discount: 102,
    taxable: 918,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9,
    rows: [
      { gstPercent: 5, line: 640, discount: 64, taxable: 576, lineTax: 28.8, net: 604.8 },
      { gstPercent: 5, line: 380, discount: 38, taxable: 342, lineTax: 17.1, net: 359.1 }
    ]
  });

  var html = invoice.render(fixture);
  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*963\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice applies the SAVE10 ₹150 discount cap for order 1004', function () {
  var fixture = order(1004, 'SAVE10', [item(5, 'Groundnut Oil', '1508', 1120, 2)], 2194.5);

  assert.deepEqual(figures(fixture), {
    subtotal: 2240,
    discount: 150,
    taxable: 2090,
    tax: 104.5,
    cgst: 52.25,
    sgst: 52.25,
    total: 2194.5,
    rows: [
      { gstPercent: 5, line: 2240, discount: 150, taxable: 2090, lineTax: 104.5, net: 2194.5 }
    ]
  });
});

test('invoice applies separate 18% and 5% HSN rates for order 1001', function () {
  var fixture = order(1001, '', [
    item(8, 'Assam CTC Masala Chai', '0902', 140, 2),
    item(2, 'Toor Dal', '0713', 165, 2)
  ], 676.9);

  assert.deepEqual(figures(fixture), {
    subtotal: 610,
    discount: 0,
    taxable: 610,
    tax: 66.9,
    cgst: 33.45,
    sgst: 33.45,
    total: 676.9,
    rows: [
      { gstPercent: 18, line: 280, discount: 0, taxable: 280, lineTax: 50.4, net: 330.4 },
      { gstPercent: 5, line: 330, discount: 0, taxable: 330, lineTax: 16.5, net: 346.5 }
    ]
  });
});

test('invoice applies separate 12% and 5% HSN rates for order 1007', function () {
  var fixture = order(1007, '', [
    item(6, 'Ghee', '0405', 450, 2),
    item(4, 'Sunflower Oil', '1512', 190, 2)
  ], 1407);

  assert.deepEqual(figures(fixture), {
    subtotal: 1280,
    discount: 0,
    taxable: 1280,
    tax: 127,
    cgst: 63.5,
    sgst: 63.5,
    total: 1407,
    rows: [
      { gstPercent: 12, line: 900, discount: 0, taxable: 900, lineTax: 108, net: 1008 },
      { gstPercent: 5, line: 380, discount: 0, taxable: 380, lineTax: 19, net: 399 }
    ]
  });
});

test('invoice totals the all-18% order 1008 at ₹590', function () {
  var fixture = order(1008, '', [
    item(8, 'Assam CTC Masala Chai', '0902', 140, 1),
    item(12, 'Kokum Sherbet', '2106', 180, 2)
  ], 590);

  assert.deepEqual(figures(fixture), {
    subtotal: 500,
    discount: 0,
    taxable: 500,
    tax: 90,
    cgst: 45,
    sgst: 45,
    total: 590,
    rows: [
      { gstPercent: 18, line: 140, discount: 0, taxable: 140, lineTax: 25.2, net: 165.2 },
      { gstPercent: 18, line: 360, discount: 0, taxable: 360, lineTax: 64.8, net: 424.8 }
    ]
  });
});

test('rendered invoice taxes discounted line value and lists the cart discount', function () {
  var fixture = order(1002, 'SAVE10', [
    item(1, 'Indrayani Basmati Rice', '1006', 640, 1),
    item(4, 'Sunflower Oil', '1512', 190, 2)
  ], 963.9);
  var html = invoice.render(fixture);

  assert.match(html, /<td class="r">[^<]*28\.80<\/td><td class="r"><strong>[^<]*640\.00<\/strong><\/td>/);
  assert.match(html, /Coupon Discount \(SAVE10\)/);
  assert.match(html, /102\.00/);
});

test('invoice recalculates totals and warns when they differ from stored ledger values', function () {
  var fixture = order(1002, 'SAVE10', [
    item(1, 'Indrayani Basmati Rice', '1006', 640, 1),
    item(4, 'Sunflower Oil', '1512', 190, 2)
  ], 1083.24);
  fixture.tax = 183.6;

  var actual = invoice.computeInvoiceFigures(fixture);
  var html = invoice.render(fixture);

  assert.equal(actual.tax, 45.9);
  assert.equal(actual.total, 963.9);
  assert.match(html, /Accountant Reconciliation Notice/);
  assert.match(html, /963\.90/);
  assert.match(html, /1083\.24/);
});
