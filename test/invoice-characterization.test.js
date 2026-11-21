'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

function order(overrides) {
  return Object.assign({
    id: 42,
    date: '2021-11-01',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    coupon: '',
    items: [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  }, overrides || {});
}

test('invoice uses the billed HSN slab for GST', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var ledger = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures(order({ items: items }));

  assert.equal(ledger.tax, 5);
  assert.equal(ledger.total, 105);
  assert.equal(printed.tax, ledger.tax);
  assert.equal(printed.total, ledger.total);
  assert.equal(printed.rows[0].gstPercent, 5);
});

test('invoice applies fractional GST rates like billed pricing', function () {
  var items = [{ id: 2, name: 'Oil', price: 100, qty: 1, gstRate: 0.05 }];
  var ledger = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures(order({ items: items }));

  assert.equal(ledger.tax, 5);
  assert.equal(printed.tax, ledger.tax);
  assert.equal(printed.rows[0].gstPercent, 5);
});

test('invoice applies the billed pre-tax discount and coupon cap', function () {
  var items = [{ id: 3, name: 'Bulk goods', price: 2000, qty: 1 }];
  var ledger = pricing.computeTotals(items, 'WHOLESALE15');
  var printed = invoice.computeInvoiceFigures(order({ items: items, coupon: 'WHOLESALE15' }));

  assert.equal(ledger.discount, 300);
  assert.equal(ledger.tax, 306);
  assert.equal(ledger.total, 2006);
  assert.equal(printed.discount, ledger.discount);
  assert.equal(printed.tax, ledger.tax);
  assert.equal(printed.total, ledger.total);
});

test('invoice rounds GST like billed pricing before splitting CGST and SGST', function () {
  var printed = invoice.computeInvoiceFigures(order({
    items: [{ id: 4, name: 'Odd tax', price: 0.1, qty: 1, gstRate: 0.05 }]
  }));

  assert.equal(printed.tax, 0.01);
  assert.equal(printed.cgst, 0.01);
  assert.equal(printed.sgst, 0);
});

test('invoice figures match the billed pricing totals and per-line GST breakdown', function () {
  var items = [
    { id: 5, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 },
    { id: 6, name: 'Tea', sku: 'TEA', hsn: '0902', price: 100, qty: 1 }
  ];
  var ledger = pricing.computeTotals(items, 'WELCOME');
  var printed = invoice.computeInvoiceFigures(order({ items: items, coupon: 'WELCOME' }));

  assert.equal(printed.subtotal, ledger.subtotal);
  assert.equal(printed.discount, ledger.discount);
  assert.equal(printed.tax, ledger.tax);
  assert.equal(printed.cgst, ledger.cgst);
  assert.equal(printed.sgst, ledger.sgst);
  assert.equal(printed.total, ledger.total);
  assert.deepEqual(printed.rows.map(function (row) {
    return { gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), ledger.lines.map(function (line) {
    return { gstPercent: line.gstPercent, lineTax: line.tax };
  }));
});

test('rendered invoice shows separate GST components and matches the stored ledger total', function () {
  var html = invoice.render(order());

  assert.match(html, /<td>CGST<\/td><td class="r">[^<]*2\.50/);
  assert.match(html, /<td>SGST<\/td><td class="r">[^<]*2\.50/);
  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
