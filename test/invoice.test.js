var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

var riceOrder = {
  id: 1002,
  coupon: 'SAVE10',
  total: 963.90,
  items: [
    { name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
  ]
};

test('invoice applies HSN rates and discounts before GST', function () {
  var figures = invoice.computeInvoiceFigures(riceOrder);
  assert.equal(figures.tax, 45.90);
  assert.equal(figures.discount, 102);
  assert.equal(figures.total, 963.90);
});

test('invoice preserves order line metadata and renders the order number', function () {
  var figures = invoice.computeInvoiceFigures(riceOrder);
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.name, row.hsn, row.qty, row.line];
  }), [['Rice', '1006', 1, 640], ['Sunflower oil', '1512', 2, 380]]);
  assert.match(invoice.render(riceOrder), /INV-1002/);
});

test('invoice and ledger agree on a standard-rate order with no coupon', function () {
  var order = { id: 1008, total: 590, items: [{ hsn: '0902', price: 500, qty: 1 }] };
  assert.equal(invoice.computeInvoiceFigures(order).total, 590);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
test('SAVE10 caps the discount before taxing groundnut oil', function () {
  var order = {
    id: 1004,
    coupon: 'SAVE10',
    total: 2194.50,
    items: [{ hsn: '1508', price: 1120, qty: 2 }]
  };
  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 104.50);
  assert.equal(figures.total, 2194.50);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('mixed HSN rates and the GST split match the order ledger', function () {
  var order = {
    id: 1007,
    total: 1407,
    items: [
      { hsn: '0405', price: 450, qty: 2 },
      { hsn: '1512', price: 190, qty: 2 }
    ]
  };
  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.total, 1407);
  assert.equal(figures.cgst + figures.sgst, 127);
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.gstPercent, row.lineTax];
  }), [[12, 108], [5, 19]]);
});
