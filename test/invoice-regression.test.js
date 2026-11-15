var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('REGRESSION: invoice total matches billed amount after HSN GST and coupon calculation', function () {
  var items = [{ id: 1, name: 'Fixture rice', sku: 'FIX-1', hsn: '1006', price: 500, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var order = { id: 1001, items: items, coupon: 'SAVE10', total: billed.total };
  var printed = invoice.computeInvoiceFigures(order);
  assert.equal(billed.total, 472.5);
  assert.equal(printed.total, 472.5);
  assert.deepEqual(printed, {
    subtotal: 500, discount: 50, tax: 22.5, cgst: 11.25, sgst: 11.25, total: 472.5,
    rows: [{ name: 'Fixture rice', sku: 'FIX-1', hsn: '1006', qty: 1, price: 500,
      gstPercent: 5, line: 500, lineTax: 22.5 }]
  });
  assert.ok(invoice.render(order).includes('Invoice Total</td><td class="r">₹472.50'));
  assert.ok(!invoice.render(order).includes('Accountant Reconciliation Notice:'));
});

test('REGRESSION: invoice sums rounded line GST rather than rounding raw aggregate tax', function () {
  var items = [
    { name: 'First', price: 0.03, qty: 1 },
    { name: 'Second', price: 0.03, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items });
  assert.equal(billed.total, 0.08);
  assert.equal(printed.total, 0.08);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst], [0.02, 0.01, 0.01]);
  assert.deepEqual(printed.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
});
