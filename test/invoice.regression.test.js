var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

test('Printed invoice matches the billed HSN GST and SAVE10 order', function () {
  // Reproduced through POST /api/orders and GET /orders/:id/invoice in a
  // temporary project copy. These are the figures actually billed by the app.
  var order = {
    id: 1009, date: '15/11/2026', customer: 'Synthetic ticket reproduction',
    coupon: 'SAVE10', subtotal: 1020, discount: 102, tax: 45.9, total: 963.9,
    items: [
      { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { id: 4, sku: 'OIL-001', name: 'Oil', hsn: '1512', price: 190, qty: 2 }
    ]
  };
  var actual = invoice.computeInvoiceFigures(order);
  assert.deepEqual({
    subtotal: actual.subtotal, discount: actual.discount, tax: actual.tax,
    cgst: actual.cgst, sgst: actual.sgst, total: actual.total,
    lines: actual.rows.map(function (row) { return [row.gstPercent, row.lineTax]; })
  }, {
    subtotal: 1020, discount: 102, tax: 45.9,
    cgst: 22.95, sgst: 22.95, total: 963.9,
    lines: [[5, 28.8], [5, 17.1]]
  });
  var html = invoice.render(order);
  assert.equal(html.includes('Invoice Total</td><td class="r">₹963.90'), true);
  assert.equal(html.includes('CGST + SGST (Total GST)</td><td class="r">₹45.90'), true);
  assert.equal(html.includes('Accountant Reconciliation Notice:'), false);
});
