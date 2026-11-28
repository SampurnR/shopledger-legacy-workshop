var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

test('invoice matches the billed HSN GST and total', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 2 }],
    total: 210
  });
  assert.equal(figures.tax, 10);
  assert.equal(figures.total, 210);
  assert.equal(figures.rows[0].lineTax, 10);
});
