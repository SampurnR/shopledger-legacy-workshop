var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

test('invoice total and GST breakdown match the discounted rice order billed to the customer', function () {
  var order = {
    id: 1001, coupon: 'SAVE10', subtotal: 1000, discount: 100, tax: 45, total: 945,
    items: [{ id: 1, sku: 'REPRO', name: 'Synthetic rice', hsn: '1006', price: 1000, qty: 1 }]
  };
  var actual = invoice.computeInvoiceFigures(order);
  assert.deepEqual(actual, {
    subtotal: 1000, discount: 100, tax: 45, cgst: 22.5, sgst: 22.5, total: 945,
    rows: [{ name: 'Synthetic rice', sku: 'REPRO', hsn: '1006', qty: 1, price: 1000, gstPercent: 5, line: 1000, lineTax: 45 }]
  });
  var html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹945\.00/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹45\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
