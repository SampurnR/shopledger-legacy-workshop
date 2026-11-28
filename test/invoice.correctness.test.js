var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

test('invoice figures match the checkout total for a SAVE10 order with 5% HSN items', function () {
  var figures = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [
      { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { id: 4, sku: 'OIL-001', name: 'Oil', hsn: '1512', price: 190, qty: 2 }
    ]
  });

  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total },
    { subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 }
  );
  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [5, 5]);
});

test('invoice figures enforce the SAVE10 ₹150 discount cap', function () {
  var figures = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [{ id: 5, sku: 'OIL-002', name: 'Groundnut Oil', hsn: '1508', price: 1120, qty: 2 }]
  });

  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 104.5);
  assert.equal(figures.total, 2194.5);
});
