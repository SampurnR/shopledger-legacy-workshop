var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('invoice figures match the totals charged at checkout', function () {
  var items = [
    { name: 'Rice', hsn: '1006', price: 2000, qty: 1 },
    { name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
  ];
  var checkout = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures(Object.assign({
    items: items, coupon: 'SAVE10'
  }, checkout));

  assert.deepEqual([printed.subtotal, printed.discount, printed.tax,
    printed.cgst, printed.sgst, printed.total],
  [checkout.subtotal, checkout.discount, checkout.tax,
    checkout.cgst, checkout.sgst, checkout.total]);
});
