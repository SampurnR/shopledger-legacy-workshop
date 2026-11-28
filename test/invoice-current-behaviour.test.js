var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

var order = {
  id: 1002, date: '05/01/2022', customer: 'Customer', paymentMode: 'upi',
  items: [
    { id: 1, name: 'Rice', sku: 'R', hsn: '1006', price: 640, qty: 1 },
    { id: 2, name: 'Oil', sku: 'O', hsn: '1512', price: 190, qty: 2 }
  ],
  coupon: 'SAVE10', subtotal: 1020, discount: 102, tax: 45.9, total: 963.9
};

test('invoice figures use discounted HSN pricing', function () {
  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.tax, 45.9);
  assert.equal(figures.discount, 102);
  assert.equal(figures.total, 963.9);
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('invoice agrees with the billed HSN rates and discounted total', function () {
  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 28.8);
  assert.equal(figures.rows[1].lineTax, 17.1);
  assert.equal(figures.discount, 102);
  assert.equal(figures.tax, 45.9);
  assert.equal(figures.total, 963.9);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 0);
  var html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹963\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice applies coupon caps and splits tax consistently', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', hsn: '1006', price: 2000, qty: 1 }], coupon: 'SAVE10'
  });
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 92.5);
  assert.equal(figures.cgst + figures.sgst, figures.tax);
  assert.equal(figures.total, 1942.5);
});
