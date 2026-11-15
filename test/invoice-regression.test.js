var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('invoice total and GST breakdown match the customer bill for capped coupon and HSN', function () {
  var items = [{ id: 1, name: 'Test Rice', price: 2000, qty: 1, hsn: '1006' }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var order = Object.assign({ id: 1, items: items, coupon: 'SAVE10' }, billed);
  var calc = invoice.computeInvoiceFigures(order);
  assert.deepEqual([calc.total, calc.tax, calc.discount, calc.cgst, calc.sgst],
    [1942.5, 92.5, 150, 46.25, 46.25]);
  assert.equal(calc.rows[0].gstPercent, 5);
  assert.equal(calc.rows[0].lineTax, 92.5);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice:/);
});
