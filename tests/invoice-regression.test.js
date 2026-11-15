var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

test('invoice total and GST match the billed rice order with a capped coupon', function () {
  var order = {
    id: 1, date: '15/11/2026', coupon: 'SAVE10',
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }],
    subtotal: 2000, discount: 150, tax: 92.5, total: 1942.5
  };
  var figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual({
    subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax,
    cgst: figures.cgst, sgst: figures.sgst, total: figures.total,
    gstPercent: figures.rows[0].gstPercent, lineTax: figures.rows[0].lineTax
  }, {
    subtotal: 2000, discount: 150, tax: 92.5,
    cgst: 46.25, sgst: 46.25, total: 1942.5, gstPercent: 5, lineTax: 92.5
  });
  var html = invoice.render(order);
  assert.ok(html.includes('Invoice Total</td><td class="r">₹1942.50'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
});
