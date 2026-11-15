var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');
var tax = require('../lib/tax');
var invoice = require('../lib/invoice');
var helpers = require('./helpers');

test('current behavior: mixed HSN rates apply after proportional coupon allocation', function () {
  var totals = pricing.computeTotals([
    { id: 1, hsn: '1006', price: 640, qty: 1 },
    { id: 2, hsn: '0902', price: 140, qty: 2 }
  ], 'SAVE10');
  assert.deepEqual([totals.subtotal, totals.discount, totals.taxable, totals.tax, totals.total],
    [920, 92, 828, 74.16, 902.16]);
  assert.deepEqual(totals.lines.map(function (line) { return line.taxable; }), [576, 252]);
  assert.deepEqual([totals.cgst, totals.sgst], [37.08, 37.08]);
});

test('current behavior: coupons normalize input, enforce minimums, expiry and caps', function () {
  assert.equal(coupons.validate(' save10 ', 2240).code, 'SAVE10');
  assert.equal(coupons.validate('SAVE10', 2240).discount, 150);
  assert.equal(coupons.validate('SAVE10', 499).valid, false);
  assert.equal(coupons.validate('SAVE10', 500).discount, 50);
  assert.equal(coupons.validate('DIWALI20', 2000).valid, false);
  assert.equal(coupons.validate('UNKNOWN', 2000).valid, false);
  assert.equal(coupons.validate('', 100).discount, 0);
});

test('current behavior: numeric GST override wins; HSN matching is exact', function () {
  assert.equal(tax.getRateForItem({ gstRate: 12, hsn: '1006' }), 0.12);
  assert.equal(tax.getRateForItem({ gstRate: 0.12 }), 0.12);
  assert.equal(tax.getRateForItem({ hsn: '1006' }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: '100610' }), 0.18);
  assert.deepEqual(tax.splitCgstSgst(0.03), { cgst: 0.02, sgst: 0.01 });
});

test('known defect: invoice ignores HSN rates and coupon caps used at checkout', function () {
  var items = [{ id: 3, name: 'Test Oil', hsn: '1508', price: 1120, qty: 2 }];
  var checkout = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });
  assert.deepEqual([checkout.discount, checkout.tax, checkout.total], [150, 104.5, 2194.5]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [264.32, 403.2, 2378.88]);
});

test('known defect: invoice still applies an inactive coupon', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ price: 1000, qty: 1, hsn: '1006' }], coupon: 'DIWALI20'
  });
  assert.equal(coupons.validate('DIWALI20', 1000).valid, false);
  assert.deepEqual([figures.discount, figures.total], [236, 944]);
});

test('current behavior: invoice HTML escapes customer text and exposes a total mismatch', function () {
  var db = helpers.createDb();
  var html = invoice.render({ id: 1001, customer: '<b>Test & Customer</b>', date: '15/04/2022',
    items: [Object.assign({}, db.products[0], { qty: 1 })], total: 672 });
  assert.ok(html.includes('&lt;b&gt;Test &amp; Customer&lt;/b&gt;'));
  assert.ok(!html.includes('<b>Test & Customer</b>'));
  assert.ok(html.includes('Accountant Reconciliation Notice:'));
});
