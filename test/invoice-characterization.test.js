var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');
var coupons = require('../lib/coupons');
var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var reports = require('../lib/reports');
var config = require('../config');

function item(price, extra) {
  return Object.assign({ id: 1, name: 'Test item', price: price, qty: 1 }, extra);
}

function billed(items, coupon) {
  return orders.add({ nextOrderId: 1, orders: [] }, Object.assign({
    date: '2026-01-02', items: items, coupon: coupon || ''
  }, pricing.computeTotals(items, coupon)));
}

function amounts(result) {
  return [result.subtotal, result.discount, result.tax, result.cgst, result.sgst, result.total];
}

test('default 18% without a coupon agrees across pricing and invoice', function () {
  var items = [item(100)];
  assert.deepEqual(amounts(pricing.computeTotals(items)), [100, 0, 18, 9, 9, 118]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(billed(items))), [100, 0, 18, 9, 9, 118]);
});

test('pricing apportions a coupon before applying mixed HSN slabs', function () {
  var result = pricing.computeTotals([
    item(200, { hsn: '1006' }), item(300, { id: 2, hsn: '0405' }),
    item(500, { id: 3, hsn: '0902' })
  ], ' save10 ');
  assert.deepEqual(amounts(result), [1000, 100, 122.4, 61.2, 61.2, 1022.4]);
  assert.equal(result.taxable, 900);
  assert.deepEqual(result.lines.map(function (line) {
    return [line.gstPercent, line.gross, line.discount, line.taxable, line.tax, line.net];
  }), [[5, 200, 20, 180, 9, 189], [12, 300, 30, 270, 32.4, 302.4], [18, 500, 50, 450, 81, 531]]);
});

test('invoice applies mixed HSN slabs after the coupon like billing', function () {
  var order = billed([item(200, { hsn: '1006' }), item(300, { hsn: '0405' }), item(500, { hsn: '0902' })], 'SAVE10');
  var result = invoice.computeInvoiceFigures(order);
  assert.equal(order.total, 1022.4);
  assert.deepEqual(amounts(result), [1000, 100, 122.4, 61.2, 61.2, 1022.4]);
  assert.deepEqual(result.rows.map(function (row) { return row.gstPercent; }), [5, 12, 18]);
  assert.deepEqual(result.rows.map(function (row) { return row.lineTax; }), [9, 32.4, 81]);
});

[
  { label: 'whole percentage', rate: 5, billing: 5, invoiced: 5, percent: 5 },
  { label: 'decimal rate', rate: 0.05, billing: 5, invoiced: 5, percent: 5 },
  { label: 'zero rate', rate: 0, billing: 0, invoiced: 0, percent: 0 },
  { label: 'numeric string falls back to HSN', rate: '12', billing: 5, invoiced: 5, percent: 5 },
  { label: 'one means 100%', rate: 1, billing: 100, invoiced: 100, percent: 100 }
].forEach(function (sample) {
  test('invoice and billing agree on GST rate interpretation - ' + sample.label, function () {
    var items = [item(100, { hsn: '1006', gstRate: sample.rate })];
    assert.equal(pricing.computeTotals(items).tax, sample.billing);
    var result = invoice.computeInvoiceFigures({ items: items });
    assert.equal(result.tax, sample.invoiced);
    assert.equal(result.rows[0].gstPercent, sample.percent);
  });
});

test('CURRENT BEHAVIOUR: HSN lookup is exact despite configuration prefix comment', function () {
  assert.equal(tax.getRateForItem({ hsn: '1006' }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: '100630' }), 0.18);
  assert.equal(tax.getRateForItem({ hsn: 'unknown' }), 0.18);
  assert.equal(tax.getRateForItem(null), 0.18);
});

[
  { label: 'percent discount reduces taxable value', price: 500, code: 'SAVE10', ledger: [500, 50, 81, 40.5, 40.5, 531] },
  { label: 'flat discount reduces taxable value', price: 500, code: 'FLAT50', ledger: [500, 50, 81, 40.5, 40.5, 531] },
  { label: 'percentage discount cap', price: 2000, code: 'SAVE10', ledger: [2000, 150, 333, 166.5, 166.5, 2183] },
  { label: 'minimum spend', price: 100, code: 'SAVE10', ledger: [100, 0, 18, 9, 9, 118] },
  { label: 'expired coupon', price: 1000, code: 'DIWALI20', ledger: [1000, 0, 180, 90, 90, 1180] },
  { label: 'normalized coupon code', price: 500, code: ' save10 ', ledger: [500, 50, 81, 40.5, 40.5, 531] },
  { label: 'flat coupon below minimum does not make total negative', price: 10, code: 'FLAT50', ledger: [10, 0, 1.8, 0.9, 0.9, 11.8] }
].forEach(function (sample) {
  test('invoice and billing agree on coupon rules - ' + sample.label, function () {
    var items = [item(sample.price)];
    assert.deepEqual(amounts(pricing.computeTotals(items, sample.code)), sample.ledger);
    assert.deepEqual(amounts(invoice.computeInvoiceFigures(billed(items, sample.code))), sample.ledger);
  });
});

test('coupon validation pins rejection messages and minimum/cap boundaries', function () {
  assert.deepEqual(coupons.validate('missing', 500), { valid: false, error: 'Invalid coupon code: MISSING' });
  assert.deepEqual(coupons.validate('DIWALI20', 1000), { valid: false, error: 'Coupon DIWALI20 has expired' });
  assert.deepEqual(coupons.validate('SAVE10', 499.99), { valid: false, error: 'Coupon SAVE10 requires a minimum order subtotal of ₹500' });
  assert.equal(coupons.validate('SAVE10', 500).discount, 50);
  assert.equal(coupons.validate('SAVE10', 1500).discount, 150);
  assert.equal(coupons.validate('SAVE10', 2000).discount, 150);
});

test('invoice sums rounded line taxes like billing', function () {
  var items = [item(0.03), item(0.03)];
  assert.deepEqual(amounts(pricing.computeTotals(items)), [0.06, 0, 0.02, 0.01, 0.01, 0.08]);
  var result = invoice.computeInvoiceFigures({ items: items });
  assert.deepEqual(amounts(result), [0.06, 0, 0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual(result.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
});

test('CURRENT BEHAVIOUR: rounding each allocated discount leaves line nets above cart total', function () {
  var result = pricing.computeTotals([item(0.09), item(0.09), item(0.09)], 'WELCOME');
  assert.deepEqual(amounts(result), [0.27, 0.01, 0.06, 0.03, 0.03, 0.32]);
  assert.deepEqual(result.lines.map(function (line) { return [line.discount, line.net]; }), [[0, 0.11], [0, 0.11], [0, 0.11]]);
});

test('CURRENT BEHAVIOUR: invoice ignores stored figures and recalculates using current configuration', function (t) {
  var order = billed([item(500)], 'SAVE10');
  order.subtotal = 1;
  order.discount = 2;
  order.tax = 3;
  order.total = 4;
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), [500, 50, 81, 40.5, 40.5, 531]);
  var oldValue = config.coupons.SAVE10.value;
  t.after(function () { config.coupons.SAVE10.value = oldValue; });
  config.coupons.SAVE10.value = 20;
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), [500, 100, 72, 36, 36, 472]);
  assert.equal(order.total, 4);
});

test('CURRENT BEHAVIOUR: tax-only mismatch is flagged in reconciliation but not invoice HTML', function () {
  var order = billed([item(500)], 'SAVE10');
  // A stale stored tax still exercises reconciliation independently of the fix.
  order.tax = 90;
  var result = reports.getGstReconciliation({ orders: [order] });
  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 1, date: '2026-01-02', customer: 'Walk-in', coupon: 'SAVE10',
    ledgerSubtotal: 500, ledgerDiscount: 50, ledgerTax: 90, ledgerTotal: 531,
    invoiceDiscount: 50, invoiceTax: 81, invoiceTotal: 531, delta: 0, matched: false
  });
  var html = invoice.render(order);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Total GST\)<\/td><td class="r">₹81\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹531\.00/);
});

test('CURRENT BEHAVIOUR: reconciliation sums absolute total deltas and excludes cancelled orders', function () {
  var positive = billed([item(500)], 'FLAT50');
  var negative = billed([item(2000)], 'SAVE10');
  // Deliberately inconsistent ledger totals keep warning coverage after the fix.
  positive.total = 522;
  negative.total = 2242;
  var cancelled = Object.assign({}, positive, { status: 'cancelled' });
  var result = reports.getGstReconciliation({ orders: [positive, negative, cancelled] });
  assert.deepEqual([result.totalChecked, result.mismatchCount, result.totalDelta], [2, 2, 68]);
  assert.deepEqual(result.rows.map(function (row) { return row.delta; }), [9, -59]);
  assert.match(invoice.render(positive), /by \+₹9\.00/);
  assert.match(invoice.render(negative), /by -₹59\.00/);
});

test('CURRENT BEHAVIOUR: invoice warning starts at a rounded one-paisa total difference', function () {
  var order = billed([item(100)]);
  order.total = 117.996;
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  order.total = 117.99;
  assert.match(invoice.render(order), /by \+₹0\.01/);
});
