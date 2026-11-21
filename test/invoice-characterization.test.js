// Run with node --test. All fixtures are in memory; no datastore is loaded.
var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');
var coupons = require('../lib/coupons');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function item(price, hsn, extra) {
  return Object.assign({ id: 1, name: 'Test item', sku: 'TEST', price: price, qty: 1, hsn: hsn }, extra);
}

function billed(items, coupon) {
  var totals = pricing.computeTotals(items, coupon);
  return orders.add({ orders: [], nextOrderId: 1 }, Object.assign({}, totals, {
    items: items, coupon: coupon, date: '2026-01-15'
  }));
}

function figures(value) {
  return [value.subtotal, value.discount, value.tax, value.cgst, value.sgst, value.total];
}

test('billing apportions SAVE10 across 5%, 12%, and 18% HSN lines before tax', function () {
  var result = pricing.computeTotals([item(200, '1006'), item(200, '0405'), item(200, '0902')], 'SAVE10');
  assert.deepEqual(figures(result), [600, 60, 63, 31.5, 31.5, 603]);
  assert.equal(result.taxable, 540);
  assert.deepEqual(result.lines.map(function (line) {
    return [line.gstPercent, line.gross, line.discount, line.taxable, line.tax, line.net];
  }), [[5, 200, 20, 180, 9, 189], [12, 200, 20, 180, 21.6, 201.6], [18, 200, 20, 180, 32.4, 212.4]]);
});

test('invoice uses billing HSN slabs and coupon rules while still recalculating stored figures', function () {
  var order = billed([item(200, '1006'), item(200, '0405'), item(200, '0902')], 'SAVE10');
  var before = structuredClone(order);
  assert.equal(order.total, 603);
  assert.deepEqual(figures(invoice.computeInvoiceFigures(order)), [600, 60, 63, 31.5, 31.5, 603]);
  assert.deepEqual(invoice.computeInvoiceFigures(order).rows.map(function (row) { return row.gstPercent; }), [5, 12, 18]);
  assert.deepEqual(order, before);
  var changed = Object.assign({}, order, { subtotal: 1, discount: 2, tax: 3, total: 4 });
  assert.deepEqual(invoice.computeInvoiceFigures(changed), invoice.computeInvoiceFigures(order));
});

test('CURRENT BEHAVIOUR: orders retain totals but discard computed GST split and line breakdowns', function () {
  var order = billed([item(100, '1006')]);
  assert.equal(order.tax, 5);
  assert.equal(order.total, 105);
  ['cgst', 'sgst', 'taxable', 'lines'].forEach(function (key) {
    assert.equal(Object.hasOwn(order, key), false);
  });
});

[
  { rate: 5, billing: 5, printed: 5, percent: 5 },
  { rate: 0.05, billing: 5, printed: 5, percent: 5 },
  { rate: 0, billing: 0, printed: 0, percent: 0 },
  { rate: '5', billing: 12, printed: 12, percent: 12 }
].forEach(function (example) {
  test('GST override ' + JSON.stringify(example.rate) + ' has the same billing/invoice interpretation', function () {
    var line = item(100, '0405', { gstRate: example.rate });
    assert.equal(pricing.computeTotals([line]).tax, example.billing);
    var result = invoice.computeInvoiceFigures({ items: [line] });
    assert.equal(result.tax, example.printed);
    assert.equal(result.rows[0].gstPercent, example.percent);
  });
});

test('CURRENT BEHAVIOUR: HSN matching is exact despite the prefix mapping comment', function () {
  assert.equal(tax.getRateForItem({ hsn: '1006' }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: '100630' }), 0.18);
  assert.equal(tax.getRateForItem({ hsn: 'unknown' }), 0.18);
  assert.equal(tax.getRateForItem(null), 0.18);
});

[
  { price: 2000, code: 'SAVE10', billing: [150, 333, 2183], printed: [150, 333, 2183] },
  { price: 100, code: 'SAVE10', billing: [0, 18, 118], printed: [0, 18, 118] },
  { price: 1000, code: 'DIWALI20', billing: [0, 180, 1180], printed: [0, 180, 1180] },
  { price: 500, code: ' save10 ', billing: [50, 81, 531], printed: [50, 81, 531] },
  { price: 300, code: 'FLAT50', billing: [50, 45, 295], printed: [50, 45, 295] },
  { price: 10, code: 'FLAT50', billing: [0, 1.8, 11.8], printed: [0, 1.8, 11.8] }
].forEach(function (example) {
  test('coupon ' + JSON.stringify(example.code) + ' on ' + example.price + ' matches between billing and invoice', function () {
    // Direct module inputs include legacy orders that the current route would reject or normalize.
    var order = billed([item(example.price, '0902')], example.code);
    var printed = invoice.computeInvoiceFigures(order);
    assert.deepEqual([order.discount, order.tax, order.total], example.billing);
    assert.deepEqual([printed.discount, printed.tax, printed.total], example.printed);
  });
});

test('coupon validation rejects expired and below-minimum codes and normalizes valid codes', function () {
  assert.equal(coupons.validate('DIWALI20', 1000).valid, false);
  assert.equal(coupons.validate('SAVE10', 100).valid, false);
  assert.equal(coupons.validate('unknown', 1000).valid, false);
  var valid = coupons.validate(' save10 ', 2000);
  assert.equal(valid.valid, true);
  assert.equal(valid.code, 'SAVE10');
  assert.equal(valid.discount, 150);
});

test('invoice and billing both sum rounded line tax', function () {
  var order = billed([item(0.03, '0902'), item(0.03, '0902')]);
  var result = invoice.computeInvoiceFigures(order);
  assert.equal(order.tax, 0.02);
  assert.equal(order.total, 0.08);
  assert.deepEqual(figures(result), [0.06, 0, 0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual(result.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.deepEqual(tax.splitCgstSgst(0.01), { cgst: 0.01, sgst: 0 });
});

test('CURRENT BEHAVIOUR: independently rounded line discounts need not sum to cart discount', function () {
  var result = pricing.computeTotals([item(0.1, '0902'), item(0.1, '0902'), item(0.1, '0902')], 'WELCOME');
  assert.equal(result.discount, 0.02);
  assert.deepEqual(result.lines.map(function (line) { return line.discount; }), [0.01, 0.01, 0.01]);
  assert.equal(result.total, 0.34);
  assert.deepEqual(result.lines.map(function (line) { return line.net; }), [0.11, 0.11, 0.11]);
});

test('percentage coupon invoice matches both billed total and GST', function () {
  var order = billed([item(500, '0902')], 'SAVE10');
  assert.equal(order.total, 531);
  assert.equal(order.tax, 81);
  assert.deepEqual(figures(invoice.computeInvoiceFigures(order)), [500, 50, 81, 40.5, 40.5, 531]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice:/);
  var recon = reports.getGstReconciliation({ orders: [order] });
  assert.equal(recon.mismatchCount, 0);
  assert.equal(recon.totalDelta, 0);
  assert.equal(recon.rows[0].matched, true);
});

test('CURRENT BEHAVIOUR: rendered invoice shows recalculated amounts and a signed ledger difference', function () {
  var order = Object.assign({}, billed([item(100, '1006')]), { total: 92 });
  var html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹5\.00/);
  assert.match(html, /recorded total \(₹92\.00\) by \+₹13\.00/);
  var negative = invoice.render(Object.assign({}, billed([item(2000, '0902')], 'SAVE10'), { total: 2242 }));
  assert.match(negative, /recorded total \(₹2242\.00\) by -₹59\.00/);
});

test('CURRENT BEHAVIOUR: a stored tax-only discrepancy is flagged by reconciliation but not the invoice banner', function () {
  var order = Object.assign({}, billed([item(500, '0902')], 'SAVE10'), { tax: 90 });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice:/);
  var recon = reports.getGstReconciliation({ orders: [order] });
  assert.equal(recon.mismatchCount, 1);
  assert.equal(recon.totalDelta, 0);
  assert.equal(recon.rows[0].matched, false);
  assert.equal(recon.rows[0].ledgerTax, 90);
  assert.equal(recon.rows[0].invoiceTax, 81);
});

test('CURRENT BEHAVIOUR: reconciliation sums absolute total differences and excludes cancelled orders', function () {
  var positive = Object.assign({}, billed([item(100, '1006')]), { total: 92 });
  var negative = Object.assign({}, billed([item(2000, '0902')], 'SAVE10'), { total: 2242 });
  var cancelled = Object.assign({}, positive, { status: 'cancelled' });
  var recon = reports.getGstReconciliation({ orders: [positive, negative, cancelled] });
  assert.equal(recon.totalChecked, 2);
  assert.equal(recon.mismatchCount, 2);
  assert.equal(recon.totalDelta, 72);
  assert.deepEqual(recon.rows.map(function (row) { return row.delta; }), [13, -59]);
});

test('customer khata and dashboard use billed totals rather than recalculated invoice totals', function () {
  var order = billed([item(100, '1006')]);
  var db = { orders: [order], products: [], customers: [{ id: 1, name: 'Test customer', creditLimit: 1000 }] };
  assert.equal(ledger.chargeOrderToKhata(db, 1, order.total).ok, true);
  assert.equal(db.customers[0].totalBilled, 105);
  assert.equal(db.customers[0].balance, 105);
  var summary = reports.getDashboardSummary(db);
  assert.equal(summary.grossRevenue, 105);
  assert.equal(summary.totalTaxCollected, 5);
  assert.equal(summary.totalKhataReceivable, 105);
  assert.equal(summary.reconciliationTotalDelta, 0);
});

test('18% orders without coupons reconcile and empty item lists compute zero figures', function () {
  var order = billed([item(100, '0902')]);
  assert.deepEqual(figures(invoice.computeInvoiceFigures(order)), [100, 0, 18, 9, 9, 118]);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 0);
  assert.deepEqual(figures(invoice.computeInvoiceFigures({})), [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(figures(pricing.computeTotals([])), [0, 0, 0, 0, 0, 0]);
});
