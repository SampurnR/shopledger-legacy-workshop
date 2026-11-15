var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

test('REGRESSION: ticket 1002 invoice uses HSN GST on discounted lines and matches billed amount', function () {
  var order = {
    id: 1002, date: '05/01/2022', coupon: 'SAVE10',
    subtotal: 1020, discount: 102, tax: 45.9, total: 963.9,
    items: [
      { name: 'Rice', sku: 'RICE', hsn: '1006', price: 640, qty: 1 },
      { name: 'Oil', sku: 'OIL', hsn: '1512', price: 190, qty: 2 }
    ]
  };
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9,
    rows: [
      { name: 'Rice', sku: 'RICE', hsn: '1006', price: 640, qty: 1,
        gstPercent: 5, line: 640, lineTax: 28.8 },
      { name: 'Oil', sku: 'OIL', hsn: '1512', price: 190, qty: 2,
        gstPercent: 5, line: 380, lineTax: 17.1 }
    ]
  });
  assert.ok(!invoice.render(order).includes('Accountant Reconciliation Notice:'));
});
