var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice figures match the GST and total calculated for the customer bill', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    sku: 'RICE-1',
    hsn: '1006',
    price: 640,
    qty: 1
  }];
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(printed.subtotal, billed.subtotal);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
  assert.equal(printed.total, billed.total);
  assert.equal(printed.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(printed.rows[0].lineTax, billed.lines[0].tax);
});
