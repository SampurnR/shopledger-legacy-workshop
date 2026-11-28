var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

test('invoice figures use saved checkout totals and legacy HSN rates', function () {
  var order = {
    id: 1002,
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    total: 963.9,
    coupon: 'SAVE10',
    items: [
      { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { id: 4, name: 'Oil', hsn: '1512', price: 190, qty: 2 }
    ]
  };

  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.subtotal, 1020);
  assert.equal(figures.discount, 102);
  assert.equal(figures.tax, 45.9);
  assert.equal(figures.total, 963.9);
  assert.deepEqual(figures.rows.map(function (row) {
    return { gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), [
    { gstPercent: 5, lineTax: 28.8 },
    { gstPercent: 5, lineTax: 17.1 }
  ]);
});

test('invoice derives a missing total without a false reconciliation warning', function () {
  var order = {
    id: 1200,
    subtotal: 100,
    discount: 0,
    tax: 5,
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  };

  var html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
