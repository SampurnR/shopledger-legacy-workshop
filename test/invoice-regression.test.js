var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

test('invoice matches billed HSN totals, capped discount, and post-discount GST', function () {
  // Synthetic version of the order reproduced over HTTP in the isolated app.
  var order = {
    id: 1001, date: '22/11/2026', customer: 'Test customer', coupon: 'SAVE10',
    items: [{ id: 1, name: 'Rice', sku: 'TEST-1', hsn: '1006', price: 1000, qty: 2 }],
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
  assert.match(invoice.render(order), /Invoice Total<\/td><td class="r">₹1942\.50/);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice:/);
});
