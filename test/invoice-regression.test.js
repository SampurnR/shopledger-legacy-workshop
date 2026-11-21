var test = require('node:test');
var assert = require('node:assert/strict');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('invoice GST and total match the billed rice order with SAVE10', function () {
  var items = [{ id: 1, sku: 'REPRO', name: 'Repro rice', price: 500, qty: 1, hsn: '1006' }];
  var totals = pricing.computeTotals(items, 'SAVE10');
  var order = orders.add({ orders: [], nextOrderId: 1 }, Object.assign({}, totals, {
    items: items, coupon: 'SAVE10', date: '2026-01-15'
  }));
  var result = invoice.computeInvoiceFigures(order);
  assert.deepEqual({ subtotal: result.subtotal, discount: result.discount, tax: result.tax,
    cgst: result.cgst, sgst: result.sgst, total: result.total },
  { subtotal: 500, discount: 50, tax: 22.5, cgst: 11.25, sgst: 11.25, total: 472.5 });
  assert.equal(result.rows[0].gstPercent, 5);
  assert.equal(result.rows[0].lineTax, 22.5);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice:/);
});
