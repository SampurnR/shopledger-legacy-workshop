var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

test('invoice figures match the billed HSN and discounted order', function () {
  var order = {
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 500, qty: 1 }],
    coupon: 'SAVE10', subtotal: 500, discount: 50, tax: 22.5, total: 472.5
  };
  var figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual([figures.subtotal, figures.discount, figures.tax, figures.cgst, figures.sgst, figures.total],
    [500, 50, 22.5, 11.25, 11.25, 472.5]);
  assert.deepEqual([figures.rows[0].gstPercent, figures.rows[0].lineTax], [5, 22.5]);
});
