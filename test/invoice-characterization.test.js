// Characterization tests for the ticket:
// "Invoice total and GST breakdown do not match what the customer was billed."
//
// These tests pin down what the code does TODAY. They are characterization
// tests only: no fixes are applied here. All fixtures are in-memory objects;
// data/db.json is never read or written.

var test = require('node:test');
var assert = require('node:assert');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');
var coupons = require('../lib/coupons');
var reports = require('../lib/reports');

function makeOrder(items, extra) {
  return Object.assign({
    id: 1004,
    date: '30/01/2022',
    customer: 'Kalyani Foods (Wholesale)',
    customerId: 5,
    paymentMode: 'khata',
    status: 'completed',
    coupon: '',
    items: items,
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0
  }, extra || {});
}

test('CURRENT BEHAVIOUR: invoice applies the HSN slab GST rate when a line item has no gstRate', function () {
  var order = makeOrder([
    { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 1020, qty: 1 }
  ]);

  var inv = invoice.computeInvoiceFigures(order);

  // CURRENT BEHAVIOUR (post-fix): rate resolved via lib/tax.js HSN slab lookup.
  assert.strictEqual(inv.subtotal, 1020);
  assert.strictEqual(inv.discount, 0);
  assert.strictEqual(inv.tax, 51);
  assert.strictEqual(inv.cgst, 25.5);
  assert.strictEqual(inv.sgst, 25.5);
  assert.strictEqual(inv.total, 1071);
  assert.strictEqual(inv.rows[0].gstPercent, 5);
});

test('CURRENT BEHAVIOUR: invoice applies the coupon discount on the subtotal with caps', function () {
  var items = [
    { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
  ];
  var order = makeOrder(items, { coupon: 'SAVE10' });

  var inv = invoice.computeInvoiceFigures(order);

  // CURRENT BEHAVIOUR (post-fix): discount computed via lib/coupons.js on the
  // subtotal with minOrder / maxDiscount caps; GST on post-discount value.
  assert.strictEqual(inv.subtotal, 2240);
  assert.strictEqual(inv.tax, 104.5);
  assert.strictEqual(inv.discount, 150);
  assert.strictEqual(inv.cgst, 52.25);
  assert.strictEqual(inv.sgst, 52.25);
  assert.strictEqual(inv.total, 2194.5);
});

test('CURRENT BEHAVIOUR: order ledger pricing caps coupon discount and taxes the post-discount HSN slab value', function () {
  var items = [
    { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
  ];

  var totals = pricing.computeTotals(items, 'SAVE10');

  assert.strictEqual(totals.subtotal, 2240);
  assert.strictEqual(totals.discount, 150);
  assert.strictEqual(totals.taxable, 2090);
  assert.strictEqual(totals.tax, 104.5);
  assert.strictEqual(totals.cgst, 52.25);
  assert.strictEqual(totals.sgst, 52.25);
  assert.strictEqual(totals.total, 2194.5);
});

test('CURRENT BEHAVIOUR: invoice figures match the ledger billed total for a coupon order', function () {
  var items = [
    { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
  ];

  var totals = pricing.computeTotals(items, 'SAVE10');
  var order = makeOrder(items, {
    coupon: 'SAVE10',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });

  var inv = invoice.computeInvoiceFigures(order);

  // Invoice figures must agree with the order ledger figures now.
  assert.strictEqual(inv.subtotal, totals.subtotal);
  assert.strictEqual(inv.discount, totals.discount);
  assert.strictEqual(inv.tax, totals.tax);
  assert.strictEqual(inv.total, totals.total);
});

test('CURRENT BEHAVIOUR: GST reconciliation finds no invoice versus ledger mismatches', function () {
  var items = [
    { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
  ];

  var totals = pricing.computeTotals(items, 'SAVE10');
  var db = {
    orders: [
      {
        id: 1004,
        date: '30/01/2022',
        customer: 'Kalyani Foods (Wholesale)',
        status: 'completed',
        coupon: 'SAVE10',
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        items: items
      }
    ]
  };

  var recon = reports.getGstReconciliation(db);

  assert.strictEqual(recon.totalChecked, 1);
  assert.strictEqual(recon.mismatchCount, 0);
  assert.strictEqual(recon.totalDelta, 0);
  assert.strictEqual(recon.rows[0].matched, true);
});

test('CURRENT BEHAVIOUR: tax rate resolution prefers the HSN slab over the default GST rate', function () {
  assert.strictEqual(tax.getRateForItem({ hsn: '1508' }), 0.05);
  assert.strictEqual(tax.getRateForItem({ gstRate: 5 }), 0.05);
  assert.strictEqual(tax.getRateForItem({}), 0.18);
  assert.strictEqual(tax.getSlabPercent({ hsn: '1006' }), 5);
});

test('CURRENT BEHAVIOUR: coupon maxDiscount cap is enforced when calculating the discount', function () {
  assert.strictEqual(coupons.calculateDiscount(3000, 'WHOLESALE15'), 400);
  assert.strictEqual(coupons.calculateDiscount(2240, 'SAVE10'), 150);
});
