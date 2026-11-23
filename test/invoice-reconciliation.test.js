var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

function sampleOrder(overrides) {
  return Object.assign({
    id: 'TEST-1',
    date: '2026-11-23',
    status: 'completed',
    customer: 'Test Customer',
    paymentMode: 'cash',
    coupon: 'SAVE10',
    items: [{ id: 'rice-1', name: 'Rice', sku: 'RICE', hsn: '1006', price: 300, qty: 2 }],
    total: 567
  }, overrides || {});
}

test('invoice figures match the order pricing calculation for HSN GST and coupon discount', function () {
  var order = sampleOrder();
  var expected = pricing.computeTotals(order.items, order.coupon);
  var actual = invoice.computeInvoiceFigures(order);

  assert.equal(actual.subtotal, expected.subtotal);
  assert.equal(actual.discount, expected.discount);
  assert.equal(actual.tax, expected.tax);
  assert.equal(actual.cgst, expected.cgst);
  assert.equal(actual.sgst, expected.sgst);
  assert.equal(actual.total, expected.total);
  assert.equal(actual.rows[0].gstPercent, 5);
  assert.equal(actual.rows[0].lineTax, 27);
});

test('invoice respects coupon maximum discount rules', function () {
  var order = sampleOrder({
    items: [{ id: 'rice-1', name: 'Rice', sku: 'RICE', hsn: '1006', price: 300, qty: 10 }],
    total: 2992.5
  });
  var actual = invoice.computeInvoiceFigures(order);

  assert.equal(actual.discount, 150);
  assert.equal(actual.total, 2992.5);
});

test('rendered invoice shows the reconciled total without a mismatch notice', function () {
  var order = sampleOrder();
  var html = invoice.render(order);

  assert.match(html, /Invoice Total[\s\S]*₹567\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('rendered invoice flags a genuinely different recorded order total', function () {
  var html = invoice.render(sampleOrder({ total: 500 }));

  assert.match(html, /Accountant Reconciliation Notice/);
});
