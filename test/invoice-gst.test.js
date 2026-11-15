var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');
var coupons = require('../lib/coupons');
var reports = require('../lib/reports');

// These modules only calculate from supplied objects/configuration. No store,
// server, application data, or persistence module is imported by this file.
function item(overrides) {
  return Object.assign({ id: 1, name: 'Fixture item', price: 100, qty: 1 }, overrides);
}

function money(figures) {
  return {
    subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax,
    cgst: figures.cgst, sgst: figures.sgst, total: figures.total
  };
}

test('CURRENT BEHAVIOUR: basic fallback GST is added to price in both calculators', function () {
  var items = [item({ qty: 2 })];
  var expected = { subtotal: 200, discount: 0, tax: 36, cgst: 18, sgst: 18, total: 236 };
  assert.deepEqual(money(pricing.computeTotals(items, '')), expected);
  var figures = invoice.computeInvoiceFigures({ items: items });
  assert.deepEqual(money(figures), expected);
  assert.deepEqual(figures.rows, [{
    name: 'Fixture item', sku: '-', hsn: '-', qty: 2, price: 100,
    gstPercent: 18, line: 200, lineTax: 36
  }]);
});

[
  ['numeric percentage overrides HSN', { gstRate: 12, hsn: '1006' }, 0.12, 0.12],
  ['decimal GST rate is honored by both calculators', { gstRate: 0.05 }, 0.05, 0.05],
  ['zero GST overrides HSN in both calculators', { gstRate: 0, hsn: '1006' }, 0, 0],
  ['string GST rate uses fallback in both calculators', { gstRate: '5' }, 0.18, 0.18],
  ['HSN slab is honored by both calculators', { hsn: '1006' }, 0.05, 0.05],
  ['longer HSN does not receive a prefix match', { hsn: '100630' }, 0.18, 0.18],
  ['unknown HSN uses fallback', { hsn: '9999' }, 0.18, 0.18]
].forEach(function (scenario) {
  test('CURRENT BEHAVIOUR: ' + scenario[0], function () {
    var line = item(scenario[1]);
    assert.equal(tax.getRateForItem(line), scenario[2]);
    assert.equal(pricing.computeTotals([line], '').tax, scenario[2] * 100);
    assert.equal(invoice.computeInvoiceFigures({ items: [line] }).tax, scenario[3] * 100);
  });
});

test('CURRENT BEHAVIOUR: mixed HSN lines receive proportional post-discount GST in both calculators', function () {
  var items = [item({ hsn: '1006', price: 200 }), item({ id: 2, hsn: '0405', price: 300 })];
  var billed = pricing.computeTotals(items, 'SAVE10');
  assert.deepEqual(money(billed), { subtotal: 500, discount: 50, tax: 41.4, cgst: 20.7, sgst: 20.7, total: 491.4 });
  assert.equal(billed.taxable, 450);
  assert.deepEqual(billed.lines, [
    { id: 1, name: 'Fixture item', hsn: '1006', gstPercent: 5, gross: 200, discount: 20, taxable: 180, tax: 9, net: 189 },
    { id: 2, name: 'Fixture item', hsn: '0405', gstPercent: 12, gross: 300, discount: 30, taxable: 270, tax: 32.4, net: 302.4 }
  ]);
  assert.deepEqual(money(invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' })), {
    subtotal: 500, discount: 50, tax: 41.4, cgst: 20.7, sgst: 20.7, total: 491.4
  });
});

test('CURRENT BEHAVIOUR: same explicit GST and percentage coupon yield equal totals and GST', function () {
  var items = [item({ price: 500, gstRate: 18 })];
  assert.deepEqual(money(pricing.computeTotals(items, 'SAVE10')), {
    subtotal: 500, discount: 50, tax: 81, cgst: 40.5, sgst: 40.5, total: 531
  });
  assert.deepEqual(money(invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' })), {
    subtotal: 500, discount: 50, tax: 81, cgst: 40.5, sgst: 40.5, total: 531
  });
});

[
  ['flat coupon reduces taxable value in both calculators', 300, 'FLAT50', 50, 45, 295, 50, 45, 295],
  ['percentage discount honors configured cap in both calculators', 2000, 'SAVE10', 150, 333, 2183, 150, 333, 2183],
  ['both calculators skip coupon below minimum subtotal', 100, 'SAVE10', 0, 18, 118, 0, 18, 118],
  ['both calculators skip inactive coupon', 1000, 'DIWALI20', 0, 180, 1180, 0, 180, 1180],
  ['both calculators normalize coupon whitespace and case', 500, ' save10 ', 50, 81, 531, 50, 81, 531],
  ['unknown coupon silently gives no discount in calculators', 500, 'UNKNOWN', 0, 90, 590, 0, 90, 590],
  ['both calculators skip below-minimum flat discount', 10, 'FLAT50', 0, 1.8, 11.8, 0, 1.8, 11.8]
].forEach(function (scenario) {
  test('CURRENT BEHAVIOUR: ' + scenario[0], function () {
    var items = [item({ price: scenario[1] })];
    var billed = pricing.computeTotals(items, scenario[2]);
    var printed = invoice.computeInvoiceFigures({ items: items, coupon: scenario[2] });
    assert.deepEqual([billed.discount, billed.tax, billed.total], scenario.slice(3, 6));
    assert.deepEqual([printed.discount, printed.tax, printed.total], scenario.slice(6, 9));
  });
});

test('CURRENT BEHAVIOUR: validation rejects unknown inactive and below-minimum coupons', function () {
  assert.deepEqual(coupons.validate('UNKNOWN', 500), { valid: false, error: 'Invalid coupon code: UNKNOWN' });
  assert.deepEqual(coupons.validate('DIWALI20', 1000), { valid: false, error: 'Coupon DIWALI20 has expired' });
  assert.deepEqual(coupons.validate('SAVE10', 499.99), {
    valid: false, error: 'Coupon SAVE10 requires a minimum order subtotal of ₹500'
  });
  assert.equal(coupons.validate(' save10 ', 500).discount, 50);
  assert.equal(coupons.calculateDiscount(3000, 'WHOLESALE15'), 400);
  assert.equal(coupons.calculateDiscount(3000, 'WELCOME'), 100);
});

test('CURRENT BEHAVIOUR: both calculators sum rounded line tax', function () {
  var items = [item({ price: 0.03 }), item({ id: 2, price: 0.03 })];
  assert.deepEqual(money(pricing.computeTotals(items, '')), {
    subtotal: 0.06, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08
  });
  var printed = invoice.computeInvoiceFigures({ items: items });
  assert.deepEqual(money(printed), { subtotal: 0.06, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08 });
  assert.deepEqual(printed.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
});

test('CURRENT BEHAVIOUR: line gross and subtotal round at different stages', function () {
  var items = [item({ price: 0.335 }), item({ id: 2, price: 0.335 })];
  var billed = pricing.computeTotals(items, '');
  assert.deepEqual(money(billed), { subtotal: 0.67, discount: 0, tax: 0.12, cgst: 0.06, sgst: 0.06, total: 0.79 });
  assert.deepEqual(billed.lines.map(function (line) { return [line.gross, line.net]; }), [[0.34, 0.4], [0.34, 0.4]]);
  assert.deepEqual(money(invoice.computeInvoiceFigures({ items: items })), {
    subtotal: 0.67, discount: 0, tax: 0.12, cgst: 0.06, sgst: 0.06, total: 0.79
  });
  assert.equal(pricing.round2(1.005), 1.01);
  assert.equal(tax.round2(1.005), 1.01);
  assert.equal(invoice.computeInvoiceFigures({ items: [item({ price: 1.005 })] }).subtotal, 1.01);
});

test('CURRENT BEHAVIOUR: proportional coupon rounding is not reconciled to cart discount', function () {
  var items = [item({ price: 0.1 }), item({ id: 2, price: 0.1 }), item({ id: 3, price: 0.1 })];
  var billed = pricing.computeTotals(items, 'WELCOME');
  assert.deepEqual(money(billed), { subtotal: 0.3, discount: 0.02, tax: 0.06, cgst: 0.03, sgst: 0.03, total: 0.34 });
  assert.deepEqual(billed.lines.map(function (line) { return [line.discount, line.taxable, line.net]; }), [
    [0.01, 0.09, 0.11], [0.01, 0.09, 0.11], [0.01, 0.09, 0.11]
  ]);
});

test('CURRENT BEHAVIOUR: odd GST paise assigns rounded half to CGST and remainder to SGST', function () {
  assert.deepEqual(tax.splitCgstSgst(0.05), { cgst: 0.03, sgst: 0.02 });
  var items = [item({ price: 1, gstRate: 5 })];
  assert.deepEqual(money(pricing.computeTotals(items, '')), { subtotal: 1, discount: 0, tax: 0.05, cgst: 0.03, sgst: 0.02, total: 1.05 });
  assert.deepEqual(money(invoice.computeInvoiceFigures({ items: items })), { subtotal: 1, discount: 0, tax: 0.05, cgst: 0.03, sgst: 0.02, total: 1.05 });
});

test('CURRENT BEHAVIOUR: empty invoices default to zero and skip flat coupons', function () {
  assert.deepEqual(invoice.computeInvoiceFigures({}), { subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: [] });
  assert.equal(pricing.computeTotals([], 'FLAT50').total, 0);
  assert.equal(invoice.computeInvoiceFigures({ coupon: 'FLAT50' }).total, 0);
});

test('CURRENT BEHAVIOUR: invoice recomputes figures ignoring stored totals and extra charge fields', function () {
  var order = { items: [item()], subtotal: 999, tax: 999, discount: 999, total: 999, shipping: 50, additionalCharges: 25 };
  assert.deepEqual(money(invoice.computeInvoiceFigures(order)), { subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118 });
});

test('CURRENT BEHAVIOUR: rendered invoice shows matching HSN total and retains signed variance for inconsistent ledger', function () {
  var order = { id: 1, items: [item({ hsn: '1006' })], total: 105 };
  var html = invoice.render(order);
  assert.ok(html.includes('Invoice Total</td><td class="r">₹105.00'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
  assert.ok(html.includes('<th class="r">Line Gross</th>'));
  assert.ok(html.includes('<strong>₹100.00</strong>'));
  assert.ok(invoice.render(Object.assign({}, order, { total: 106 })).includes('by -₹1.00.'));
  assert.ok(!invoice.render(Object.assign({}, order, { total: 105 })).includes('Accountant Reconciliation Notice:'));
  assert.ok(invoice.render(Object.assign({}, order, { total: 104.99 })).includes('by +₹0.01.'));
});

test('CURRENT BEHAVIOUR: reconciliation matches discounted GST and still flags corrupt tax-only figures and skips cancelled orders', function () {
  var order = { id: 1, date: '01/01/2026', items: [item({ price: 500, gstRate: 18 })], coupon: 'SAVE10', subtotal: 500, discount: 50, tax: 81, total: 531 };
  var result = reports.getGstReconciliation({ orders: [order, Object.assign({}, order, { id: 2, status: 'cancelled' })] });
  assert.deepEqual(result, {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{ orderId: 1, date: '01/01/2026', customer: 'Walk-in', coupon: 'SAVE10', ledgerSubtotal: 500, ledgerDiscount: 50, ledgerTax: 81, ledgerTotal: 531, invoiceDiscount: 50, invoiceTax: 81, invoiceTotal: 531, delta: 0, matched: true }]
  });
  assert.ok(!invoice.render(order).includes('Accountant Reconciliation Notice:'));
  var corrupt = Object.assign({}, order, { tax: 90 });
  var mismatch = reports.getGstReconciliation({ orders: [corrupt] });
  assert.equal(mismatch.mismatchCount, 1);
  assert.equal(mismatch.rows[0].delta, 0);
  assert.equal(mismatch.rows[0].matched, false);
  assert.ok(!invoice.render(corrupt).includes('Accountant Reconciliation Notice:'));
});

test('CURRENT BEHAVIOUR: reconciliation sums absolute total variances including pending orders', function () {
  var base = { items: [item()], subtotal: 100, discount: 0, tax: 18 };
  var result = reports.getGstReconciliation({ orders: [
    Object.assign({}, base, { id: 1, total: 105, status: 'pending' }),
    Object.assign({}, base, { id: 2, total: 119 }),
    Object.assign({}, base, { id: 3, total: 118 })
  ] });
  assert.deepEqual([result.totalChecked, result.mismatchCount, result.totalDelta], [3, 2, 14]);
  assert.deepEqual(result.rows.map(function (row) { return [row.delta, row.matched]; }), [[13, false], [-1, false], [0, true]]);
});
