'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('./invoice');

test('SAVE10 invoice matches the discounted HSN-taxed amount billed for order 1002', function () {
  var order = {
    id: 1002,
    coupon: 'SAVE10',
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    total: 963.9,
    items: [
      { name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 },
      { name: 'Sunflower oil', sku: 'OIL-001', hsn: '1512', price: 190, qty: 2 }
    ]
  };

  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, 102);
  assert.equal(figures.tax, 45.9);
  assert.equal(figures.total, 963.9);
  assert.equal(figures.cgst, 22.95);
  assert.equal(figures.sgst, 22.95);
  var html = invoice.render(order);
  assert.match(html, /Total GST<\/td><td class="r">[^<]*45\.90/);
  assert.match(html, /CGST<\/td><td class="r">[^<]*22\.95/);
  assert.match(html, /SGST<\/td><td class="r">[^<]*22\.95/);
  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*963\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('SAVE10 invoice honors the configured maximum discount', function () {
  var order = {
    id: 1004,
    coupon: 'SAVE10',
    subtotal: 2240,
    discount: 150,
    tax: 104.5,
    total: 2194.5,
    items: [{ name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 }]
  };

  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 104.5);
  assert.equal(figures.total, 2194.5);
});

test('invoice resolves 5%, 12%, and 18% HSN slabs and displays the GST split', function () {
  var order = {
    id: 2000,
    coupon: '',
    subtotal: 850,
    discount: 0,
    tax: 125,
    total: 975,
    items: [
      { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
      { name: 'Butter', hsn: '0405', price: 250, qty: 1 },
      { name: 'Tea', hsn: '0902', price: 500, qty: 1 }
    ]
  };

  var figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [5, 12, 18]);
  assert.equal(figures.tax, 125);
  assert.equal(figures.total, 975);
  var html = invoice.render(order);
  assert.match(html, /CGST/);
  assert.match(html, /SGST/);
});

test('legacy no-coupon orders 1001, 1007, and 1008 retain their billed totals', function () {
  var orders = [
    {
      id: 1001, subtotal: 610, discount: 0, tax: 66.9, total: 676.9,
      items: [
        { name: 'Tea', hsn: '0902', price: 140, qty: 2 },
        { name: 'Dal', hsn: '0713', price: 165, qty: 2 }
      ]
    },
    {
      id: 1007, subtotal: 1280, discount: 0, tax: 127, total: 1407,
      items: [
        { name: 'Ghee', hsn: '0405', price: 450, qty: 2 },
        { name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
      ]
    },
    {
      id: 1008, subtotal: 500, discount: 0, tax: 90, total: 590,
      items: [
        { name: 'Tea', hsn: '0902', price: 140, qty: 1 },
        { name: 'Sherbet', hsn: '2106', price: 180, qty: 2 }
      ]
    }
  ];

  orders.forEach(function (order) {
    var figures = invoice.computeInvoiceFigures(order);
    assert.equal(figures.tax, order.tax, 'GST for order ' + order.id);
    assert.equal(figures.total, order.total, 'total for order ' + order.id);
    assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  });
});

test('invoice line breakdown applies the proportional coupon discount before GST', function () {
  var order = {
    id: 2001,
    coupon: 'SAVE10',
    subtotal: 1000,
    discount: 100,
    tax: 103.5,
    total: 1003.5,
    items: [
      { name: 'Rice', hsn: '1006', price: 500, qty: 1 },
      { name: 'Tea', hsn: '0902', price: 500, qty: 1 }
    ]
  };

  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.rows[0].discount, 50);
  assert.equal(figures.rows[0].taxable, 450);
  assert.equal(figures.rows[0].lineTax, 22.5);
  assert.equal(figures.rows[1].discount, 50);
  assert.equal(figures.rows[1].taxable, 450);
  assert.equal(figures.rows[1].lineTax, 81);
});
