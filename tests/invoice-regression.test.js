// Run with: node --test. All fixtures are in memory.
var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

test('Issue #1: invoice #1002 matches billed total and discounted HSN GST', function () {
  var order = {
    id: 1002, coupon: 'SAVE10', subtotal: 1020, discount: 102, tax: 45.9, total: 963.9,
    items: [
      { name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { name: 'Oil', hsn: '1512', price: 190, qty: 2 }
    ]
  };
  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.total, 963.9);
  assert.equal(figures.discount, 102);
  assert.equal(figures.tax, 45.9);
  assert.equal(figures.cgst, 22.95);
  assert.equal(figures.sgst, 22.95);
  assert.deepEqual(figures.rows.map(function (row) { return [row.gstPercent, row.lineTax]; }),
    [[5, 28.8], [5, 17.1]]);
  assert.match(invoice.render(order), /Invoice Total<\/td><td class="r">\u20b9963\.90/);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice:/);
});

test('Issue #1: invoice #1004 honours SAVE10 cap and 5 percent GST', function () {
  var order = {
    id: 1004, coupon: 'SAVE10', subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5,
    items: [{ name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 }]
  };
  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.total, 2194.5);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 104.5);
  assert.equal(figures.cgst, 52.25);
  assert.equal(figures.sgst, 52.25);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 104.5);
});
