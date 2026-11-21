// ====================================================================
// Invoice calculations and rendering
// Covers workshop ticket 1: invoice totals and GST reconciliation
// ====================================================================

var test = require('node:test');
var describe = test.describe;
var assert = require('node:assert/strict');
var invoice = require('./invoice');

var riceOrder = { coupon: 'SAVE10', items: [
  { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 640, qty: 1 },
  { id: 4, sku: 'OIL-001', name: 'Oil', hsn: '1512', price: 190, qty: 2 }
] };
var cappedOrder = { coupon: 'SAVE10', items: [
  { id: 5, name: 'Oil', hsn: '1508', price: 1120, qty: 2 }
] };
var mixedOrder = { coupon: '', items: [
  { id: 8, name: 'Tea', hsn: '0902', price: 140, qty: 2 },
  { id: 2, name: 'Dal', hsn: '0713', price: 165, qty: 2 }
] };

// ====================================================================
// invoice.computeInvoiceFigures and invoice.render
// Covers: workshop ticket 1 (invoice total and GST breakdown)
// Cases:
//   [x] SAVE10 applies before tax and respects its cap
//   [x] HSN and explicit rates select the right tax, including fallback
//   [x] flat discounts are apportioned over mixed GST slabs
//   [x] expired and ineligible coupons give no discount
//   [x] empty orders and HTML rendering remain safe
// ====================================================================
describe('invoice', function () {
test('SAVE10 discount is applied before HSN tax', function () {
  var result = invoice.computeInvoiceFigures(riceOrder);
  assert.equal(result.discount, 102);
  assert.equal(result.tax, 45.9);
  assert.equal(result.total, 963.9);
});

test('SAVE10 discount respects its cap', function () {
  var result = invoice.computeInvoiceFigures(cappedOrder);
  assert.equal(result.discount, 150);
  assert.equal(result.total, 2194.5);
});

test('mixed HSN items use their respective rates', function () {
  var result = invoice.computeInvoiceFigures(mixedOrder);
  assert.equal(result.tax, 66.9);
  assert.equal(result.total, 676.9);
});

test('18 percent order without coupon computes its total', function () {
  var result = invoice.computeInvoiceFigures({ items: [{ name: 'Tea', hsn: '0902', price: 500, qty: 1 }] });
  assert.equal(result.tax, 90);
  assert.equal(result.total, 590);
});

test('flat coupon apportions the discount before tax across mixed slabs', function () {
  var result = invoice.computeInvoiceFigures({ coupon: 'FLAT50', items: [
    { name: 'Butter', hsn: '0405', price: 260, qty: 1 },
    { name: 'Tea', hsn: '0902', price: 140, qty: 1 }
  ] });
  assert.equal(result.discount, 50);
  assert.equal(result.tax, 49.35);
  assert.equal(result.total, 399.35);
  assert.deepEqual(result.rows.map(function (row) { return [row.gstPercent, row.lineTax]; }), [[12, 27.3], [18, 22.05]]);
  assert.equal(result.cgst + result.sgst, result.tax);
});

test('explicit decimal GST rate and missing HSN use checkout rate rules', function () {
  var result = invoice.computeInvoiceFigures({ items: [
    { name: 'Custom', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Fallback', price: 100, qty: 1 }
  ] });
  assert.deepEqual(result.rows.map(function (row) { return row.gstPercent; }), [5, 18]);
  assert.equal(result.tax, 23);
  assert.equal(result.total, 223);
});

test('expired and below-minimum coupons do not discount the invoice', function () {
  var items = [{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }];
  assert.equal(invoice.computeInvoiceFigures({ items: items, coupon: 'DIWALI20' }).discount, 0);
  assert.equal(invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' }).discount, 0);
});

test('invoice HTML escapes customer and item names and shows real mismatches', function () {
  var html = invoice.render({ id: 42, date: '01/01/2022', customer: '<script>', items: [
    { name: '<Tea>', hsn: '0902', price: 100, qty: 1 }
  ], total: 100 });
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;Tea&gt;/);
  assert.match(html, /Accountant Reconciliation Notice/);
  assert.doesNotMatch(html, /<script>/);
});

test('empty order has zero totals', function () {
  var result = invoice.computeInvoiceFigures({});
  assert.equal(result.total, 0);
  assert.equal(result.tax, 0);
  assert.deepEqual(result.rows, []);
});

});
