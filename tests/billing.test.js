var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');
var coupons = require('../lib/coupons');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function item(price, hsn, gstRate) {
  return { id: 1, name: 'Synthetic item', price: price, qty: 1, hsn: hsn, gstRate: gstRate };
}

function figures(items, coupon) {
  var billed = pricing.computeTotals(items, coupon);
  var order = Object.assign({ id: 1, items: items, coupon: coupon || '' }, billed);
  return { billed: billed, order: order, printed: invoice.computeInvoiceFigures(order) };
}

test('pricing apportions a coupon across mixed HSN slabs before calculating GST', function () {
  var actual = pricing.computeTotals([
    item(500, '1006'), item(300, '0405'), item(200, '0902')
  ], 'SAVE10');
  assert.deepEqual(actual, {
    subtotal: 1000, discount: 100, taxable: 900, tax: 87.3,
    cgst: 43.65, sgst: 43.65, total: 987.3,
    lines: [
      { id: 1, name: 'Synthetic item', hsn: '1006', gstPercent: 5, gross: 500, discount: 50, taxable: 450, tax: 22.5, net: 472.5 },
      { id: 1, name: 'Synthetic item', hsn: '0405', gstPercent: 12, gross: 300, discount: 30, taxable: 270, tax: 32.4, net: 302.4 },
      { id: 1, name: 'Synthetic item', hsn: '0902', gstPercent: 18, gross: 200, discount: 20, taxable: 180, tax: 32.4, net: 212.4 }
    ]
  });
});

test('tax resolves numeric overrides, exact HSN slabs, and the default rate', function () {
  assert.equal(tax.getRateForItem(item(100, '1006', 12)), 0.12);
  assert.equal(tax.getRateForItem(item(100, '1006', 0.12)), 0.12);
  assert.equal(tax.getRateForItem(item(100, '1006', 0)), 0);
  assert.equal(tax.getRateForItem(item(100, '1006', '12')), 0.05);
  assert.equal(tax.getRateForItem(item(100, '0405', NaN)), 0.12);
  assert.equal(tax.getRateForItem(null), 0.18);
  assert.equal(tax.getRateForItem(item(100, 'unknown')), 0.18);
});

test('CURRENT BEHAVIOUR: HSN lookup uses exact codes rather than prefix matching', function () {
  assert.equal(tax.getRateForItem(item(100, '100630')), 0.18);
});

test('coupons normalize codes, enforce minimums and caps, and reject expired codes', function () {
  assert.equal(coupons.normalizeCode(' save10 '), 'SAVE10');
  assert.equal(coupons.validate('SAVE10', 499).valid, false);
  assert.equal(coupons.calculateDiscount(499, 'SAVE10'), 0);
  assert.equal(coupons.calculateDiscount(500, 'SAVE10'), 50);
  assert.equal(coupons.calculateDiscount(2000, 'SAVE10'), 150);
  assert.equal(coupons.calculateDiscount(3000, 'WELCOME'), 100);
  assert.equal(coupons.calculateDiscount(3000, 'WHOLESALE15'), 400);
  assert.equal(coupons.calculateDiscount(300, 'FLAT50'), 50);
  assert.equal(coupons.validate('DIWALI20', 2000).valid, false);
  assert.equal(coupons.calculateDiscount(2000, 'DIWALI20'), 0);
  assert.equal(coupons.validate('MISSING', 1000).valid, false);
  assert.equal(coupons.calculateDiscount(1000, 'MISSING'), 0);
  assert.deepEqual(coupons.validate('', 0), { valid: true, code: '', discount: 0 });
});

test('invoice uses HSN slabs and still computes independently of stored billed totals', function () {
  var actual = figures([item(100, '1006')]);
  assert.equal(actual.billed.tax, 5);
  assert.equal(actual.billed.total, 105);
  assert.deepEqual(actual.printed, {
    subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105,
    rows: [{ name: 'Synthetic item', sku: '-', hsn: '1006', qty: 1, price: 100, gstPercent: 5, line: 100, lineTax: 5 }]
  });
  actual.order.subtotal = 900;
  actual.order.discount = 800;
  actual.order.tax = 700;
  actual.order.total = 600;
  assert.deepEqual(invoice.computeInvoiceFigures(actual.order), actual.printed);
});

test('invoice honors decimal, zero, and percentage GST overrides consistently with billing', function () {
  var decimal = figures([item(100, '0902', 0.18)]);
  assert.equal(decimal.billed.tax, 18);
  assert.equal(decimal.printed.tax, 18);
  assert.equal(decimal.printed.rows[0].gstPercent, 18);
  var zero = figures([item(100, '0902', 0)]);
  assert.equal(zero.billed.tax, 0);
  assert.equal(zero.printed.tax, 0);
  var percent = figures([item(100, '0902', 18)]);
  assert.equal(percent.billed.tax, 18);
  assert.equal(percent.printed.tax, 18);
});

test('percent coupon produces matching invoice and billed totals and GST breakdowns', function () {
  var actual = figures([item(1000, '0902')], 'SAVE10');
  assert.equal(actual.billed.discount, 100);
  assert.equal(actual.billed.tax, 162);
  assert.equal(actual.billed.total, 1062);
  assert.equal(actual.printed.discount, 100);
  assert.equal(actual.printed.tax, 162);
  assert.equal(actual.printed.total, 1062);
});

test('invoice percent discount respects the coupon cap', function () {
  var actual = figures([item(2000, '0902')], 'SAVE10');
  assert.equal(actual.billed.discount, 150);
  assert.equal(actual.billed.tax, 333);
  assert.equal(actual.billed.total, 2183);
  assert.equal(actual.printed.discount, 150);
  assert.equal(actual.printed.tax, 333);
  assert.equal(actual.printed.total, 2183);
});

test('flat invoice discount reduces the taxable amount before GST', function () {
  var actual = figures([item(500, '0902')], 'FLAT50');
  assert.equal(actual.billed.tax, 81);
  assert.equal(actual.billed.total, 531);
  assert.equal(actual.printed.tax, 81);
  assert.equal(actual.printed.discount, 50);
  assert.equal(actual.printed.total, 531);
});

test('invoice ignores expired and below-minimum coupons without producing a negative total', function () {
  assert.equal(figures([item(1000, '0902')], 'DIWALI20').printed.discount, 0);
  var small = figures([item(10, '0902')], 'FLAT50');
  assert.equal(small.billed.discount, 0);
  assert.equal(small.printed.discount, 0);
  assert.equal(small.printed.total, 11.8);
});

test('invoice coupon lookup normalizes codes consistently with billing', function () {
  var actual = figures([item(1000, '0902')], ' save10 ');
  assert.equal(actual.billed.discount, 100);
  assert.equal(actual.printed.discount, 100);
  assert.equal(actual.printed.total, 1062);
});

test('CURRENT BEHAVIOUR: per-line discount rounding can leave line totals short of the billed total', function () {
  var actual = pricing.computeTotals([item(0.1, '1006'), item(0.1, '1006'), item(0.1, '1006')], 'WELCOME');
  assert.equal(actual.discount, 0.02);
  assert.deepEqual(actual.lines.map(function (line) { return line.discount; }), [0.01, 0.01, 0.01]);
  assert.deepEqual(actual.lines.map(function (line) { return line.net; }), [0.09, 0.09, 0.09]);
  assert.equal(actual.taxable, 0.28);
  assert.equal(actual.total, 0.28);
});

test('invoice rounds GST per line consistently with billing', function () {
  var actual = figures([item(0.03, '0902'), item(0.03, '0902')]);
  assert.equal(actual.billed.tax, 0.02);
  assert.equal(actual.billed.total, 0.08);
  assert.equal(actual.printed.tax, 0.02);
  assert.equal(actual.printed.total, 0.08);
  assert.deepEqual(actual.printed.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.deepEqual(tax.splitCgstSgst(0.01), { cgst: 0.01, sgst: 0 });
});

test('empty carts produce zero figures', function () {
  var actual = figures([]);
  assert.equal(actual.billed.total, 0);
  assert.deepEqual(actual.printed, { subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: [] });
});

test('CURRENT BEHAVIOUR: reconciliation detects tax-only mismatches but rendered invoice has no notice', function () {
  var actual = figures([item(1000, '0902')], 'SAVE10');
  // Simulate an inconsistent stored ledger; invoice calculation now matches billing.
  actual.order.tax = 144;
  var recon = reports.getGstReconciliation({ orders: [actual.order] });
  assert.equal(recon.totalChecked, 1);
  assert.equal(recon.mismatchCount, 1);
  assert.equal(recon.totalDelta, 0);
  assert.equal(recon.rows[0].matched, false);
  assert.equal(recon.rows[0].delta, 0);
  assert.equal(recon.rows[0].ledgerTax, 144);
  assert.equal(recon.rows[0].invoiceTax, 162);
  assert.doesNotMatch(invoice.render(actual.order), /Accountant Reconciliation Notice/);
});

test('CURRENT BEHAVIOUR: reconciliation sums absolute total differences and skips cancelled orders', function () {
  var higher = figures([item(100, '1006')]).order;
  var lower = figures([item(2000, '0902')], 'SAVE10').order;
  // Preserve coverage of reconciliation for historical/inconsistent stored totals.
  higher.total = 92;
  lower.total = 2242;
  var cancelled = Object.assign({}, higher, { id: 3, status: 'cancelled' });
  var recon = reports.getGstReconciliation({ orders: [higher, lower, cancelled] });
  assert.equal(recon.totalChecked, 2);
  assert.equal(recon.mismatchCount, 2);
  assert.deepEqual(recon.rows.map(function (row) { return row.delta; }), [13, -59]);
  assert.equal(recon.totalDelta, 72);
});

test('invoice renders a notice for a total mismatch and none for a matched order', function () {
  var order = figures([item(100, '1006')]).order;
  order.total = 92;
  var html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.match(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Order Ledger recorded total \(₹92\.00\) by \+₹13\.00/);
  assert.doesNotMatch(invoice.render(figures([item(100, '0902')]).order), /Accountant Reconciliation Notice/);
});
