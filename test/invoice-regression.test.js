var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

test('REGRESSION: SAVE10 invoice matches billed total and discounted HSN GST breakdown', function () {
  // Entirely synthetic; no filesystem, store, or application database.
  var order = {
    id: 1002, date: '05/01/2022', customer: 'Test Customer', coupon: 'SAVE10',
    subtotal: 1020, discount: 102, tax: 45.9, total: 963.9,
    items: [
      { id: 1, name: 'Rice', sku: 'TEST-1', hsn: '1006', price: 640, qty: 1 },
      { id: 2, name: 'Oil', sku: 'TEST-2', hsn: '1512', price: 190, qty: 2 }
    ]
  };
  var figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual({ discount: figures.discount, tax: figures.tax, cgst: figures.cgst, sgst: figures.sgst, total: figures.total }, {
    discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9
  });
  assert.deepEqual(figures.rows.map(function (row) { return [row.gstPercent, row.lineTax]; }), [[5, 28.8], [5, 17.1]]);
  var html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹963\.90<\/td>/);
  assert.match(html, /Total GST\)<\/td><td class="r">₹45\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
});
