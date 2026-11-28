var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice total and GST match the billed HSN order after SAVE10', function () {
  var order = {
    id: 1, items: [{ id: 1, name: 'Synthetic rice', sku: 'TEST', hsn: '1006', price: 500, qty: 1 }],
    coupon: 'SAVE10', subtotal: 500, discount: 50, tax: 22.5, total: 472.5
  };
  var figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual({ total: figures.total, tax: figures.tax, discount: figures.discount,
    cgst: figures.cgst, sgst: figures.sgst, lineTax: figures.rows[0].lineTax,
    gstPercent: figures.rows[0].gstPercent }, {
    total: 472.5, tax: 22.5, discount: 50, cgst: 11.25, sgst: 11.25, lineTax: 22.5, gstPercent: 5
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 0);
});
