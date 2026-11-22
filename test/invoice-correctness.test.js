var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

test('invoice #1002 matches the amount and GST actually billed at checkout', function () {
  var order = {
    id: 1002,
    coupon: 'SAVE10',
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    total: 963.9,
    items: [
      { id: 1, name: 'Fixture rice', sku: 'TEST-RICE', hsn: '1006', price: 640, qty: 1 },
      { id: 4, name: 'Fixture oil', sku: 'TEST-OIL', hsn: '1512', price: 190, qty: 2 }
    ]
  };

  var result = invoice.computeInvoiceFigures(order);
  assert.deepStrictEqual({
    subtotal: result.subtotal,
    discount: result.discount,
    tax: result.tax,
    cgst: result.cgst,
    sgst: result.sgst,
    total: result.total
  }, {
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9
  });

  assert.deepStrictEqual(result.rows, [
    { name: 'Fixture rice', sku: 'TEST-RICE', hsn: '1006', price: 640, qty: 1, gstPercent: 5, line: 640, lineTax: 28.8 },
    { name: 'Fixture oil', sku: 'TEST-OIL', hsn: '1512', price: 190, qty: 2, gstPercent: 5, line: 380, lineTax: 17.1 }
  ]);
});
