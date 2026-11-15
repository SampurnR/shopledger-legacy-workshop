var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');
var coupons = require('../lib/coupons');
var orders = require('../lib/orders');
var reports = require('../lib/reports');

// Baselines below were observed by calling the existing functions on synthetic
// in-memory fixtures with Node v24.11.0. They are not corrected financial results.
// No storage module, database fixture, configuration mutation, or HTTP server.
function item(overrides) {
  return Object.assign({
    id: 1, name: 'Sample', sku: 'S-1', hsn: '0902', price: 100, qty: 1
  }, overrides);
}

function figures(result) {
  return [result.subtotal, result.discount, result.tax,
    result.cgst, result.sgst, result.total];
}

function calculate(items, coupon) {
  return invoice.computeInvoiceFigures({ items: items, coupon: coupon });
}

test('A single line preserves quantity, price, SKU and invoice/order figures', function () {
  var lines = [item()];
  assert.deepEqual(calculate(lines), {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118,
    rows: [{ name: 'Sample', sku: 'S-1', hsn: '0902', qty: 1,
      price: 100, gstPercent: 18, line: 100, lineTax: 18 }]
  });
  assert.deepEqual(pricing.computeTotals(lines), {
    subtotal: 100, discount: 0, taxable: 100, tax: 18,
    cgst: 9, sgst: 9, total: 118,
    lines: [{ id: 1, name: 'Sample', hsn: '0902', gstPercent: 18,
      gross: 100, discount: 0, taxable: 100, tax: 18, net: 118 }]
  });
  assert.equal(pricing.subtotal(lines), 100);
});

test('Invoice uses HSN slabs for several order lines', function () {
  // Regression: invoice now shares checkout's HSN calculation; previously
  // every line defaulted to 18%, producing tax 70.20 and total 460.20.
  var lines = [
    item({ name: 'Rice', hsn: '1006', price: 100, qty: 2 }),
    item({ id: 2, name: 'Butter', hsn: '0405', price: 50, qty: 3 }),
    item({ id: 3, name: 'Tea', hsn: '0902', price: 40 })
  ];
  var actual = calculate(lines);
  var billed = pricing.computeTotals(lines);
  assert.deepEqual(figures(actual), [390, 0, 35.2, 17.6, 17.6, 425.2]);
  assert.deepEqual(actual.rows.map(function (r) {
    return [r.qty, r.price, r.gstPercent, r.line, r.lineTax];
  }), [[2, 100, 5, 200, 10], [3, 50, 12, 150, 18], [1, 40, 18, 40, 7.2]]);
  assert.deepEqual(figures(billed), [390, 0, 35.2, 17.6, 17.6, 425.2]);
  assert.deepEqual(billed.lines.map(function (r) {
    return [r.gstPercent, r.tax, r.net];
  }), [[5, 10, 210], [12, 18, 168], [18, 7.2, 47.2]]);
  assert.equal(actual.rows.reduce(function (sum, r) { return sum + r.lineTax; }, 0), 35.2);
  assert.equal(billed.lines.reduce(function (sum, r) { return sum + r.net; }, 0), 425.2);
});

test('All eleven configured HSN mappings resolve to their current rates', function () {
  var hsns = ['1006', '0713', '1104', '1512', '1508', '1701',
    '0405', '0904', '0902', '0901', '2106'];
  assert.deepEqual(hsns.map(function (hsn) {
    return [hsn, tax.getRateForItem({ hsn: hsn }), tax.getSlabPercent({ hsn: hsn })];
  }), [
    ['1006', 0.05, 5], ['0713', 0.05, 5], ['1104', 0.05, 5],
    ['1512', 0.05, 5], ['1508', 0.05, 5], ['1701', 0.05, 5],
    ['0405', 0.12, 12], ['0904', 0.12, 12], ['0902', 0.18, 18],
    ['0901', 0.18, 18], ['2106', 0.18, 18]
  ]);
});

[
  { rate: 5, lookup: 0.05, result: [100, 0, 5, 2.5, 2.5, 105] },
  { rate: 12, lookup: 0.12, result: [100, 0, 12, 6, 6, 112] },
  { rate: 18, lookup: 0.18, result: [100, 0, 18, 9, 9, 118] },
  { rate: 28, lookup: 0.28, result: [100, 0, 28, 14, 14, 128] }
].forEach(function (baseline) {
  test('Explicit percentage override ' + baseline.rate + ' is used by both calculators', function () {
    var line = item({ gstRate: baseline.rate });
    assert.equal(tax.getRateForItem(line), baseline.lookup);
    assert.deepEqual(figures(calculate([line])), baseline.result);
    assert.deepEqual(figures(pricing.computeTotals([line])), baseline.result);
  });
});

test('Invoice preserves an explicit zero GST rate', function () {
  // Regression: invoice previously replaced gstRate: 0 with the fallback,
  // producing tax 18 and total 118 instead of zero tax and total 100.
  var lines = [item({ gstRate: 0 })];
  assert.equal(tax.getRateForItem(lines[0]), 0);
  assert.deepEqual(figures(pricing.computeTotals(lines)), [100, 0, 0, 0, 0, 100]);
  assert.deepEqual(figures(calculate(lines)), [100, 0, 0, 0, 0, 100]);
});

test('Invoice accepts decimal GST override 0.18 as 18%', function () {
  // Regression: invoice previously interpreted 0.18 as 0.18%, returning
  // tax 0.18, total 100.18 and a displayed rate of 0%.
  var lines = [item({ gstRate: 0.18 })];
  assert.equal(tax.getRateForItem(lines[0]), 0.18);
  assert.deepEqual(figures(calculate(lines)), [100, 0, 18, 9, 9, 118]);
  assert.equal(calculate(lines).rows[0].gstPercent, 18);
  assert.deepEqual(figures(pricing.computeTotals(lines)), [100, 0, 18, 9, 9, 118]);
});

test('Missing GST and unknown HSN fall back to 18%', function () {
  var lines = [item({ hsn: undefined })];
  assert.equal(tax.getRateForItem(), 0.18);
  assert.equal(tax.getRateForItem({}), 0.18);
  assert.equal(tax.getRateForItem({ hsn: 'UNKNOWN' }), 0.18);
  assert.deepEqual(figures(calculate(lines)), [100, 0, 18, 9, 9, 118]);
  assert.deepEqual(figures(pricing.computeTotals(lines)), [100, 0, 18, 9, 9, 118]);
});

test('Intra-state split uses CGST and SGST, including an odd paise remainder', function () {
  assert.deepEqual(tax.splitCgstSgst(18), { cgst: 9, sgst: 9 });
  assert.deepEqual(tax.splitCgstSgst(0.01), { cgst: 0.01, sgst: 0 });
  assert.deepEqual(tax.splitCgstSgst(0.15), { cgst: 0.08, sgst: 0.07 });
  var a = calculate([item()]);
  var b = pricing.computeTotals([item()]);
  assert.equal(a.cgst + a.sgst, 18);
  assert.equal(b.cgst + b.sgst, 18);
});

test('No interstate calculation exists: region metadata does not switch either calculator to IGST', function () {
  // stateCode here is deliberately unsupported metadata, not a claimed API.
  // Neither calculator inspects a place of supply or has an IGST branch.
  var actual = invoice.computeInvoiceFigures({
    items: [item()], stateCode: '29 (Karnataka)'
  });
  var billed = pricing.computeTotals([item({ stateCode: '29 (Karnataka)' })]);
  assert.deepEqual(figures(actual), [100, 0, 18, 9, 9, 118]);
  assert.deepEqual(figures(billed), [100, 0, 18, 9, 9, 118]);
  assert.equal(Object.hasOwn(actual, 'igst'), false);
  assert.equal(Object.hasOwn(billed, 'igst'), false);
});

test('Both calculators treat supplied prices as tax-exclusive; no inclusive mode exists', function () {
  var lines = [item({ price: 118, gstRate: 18 })];
  assert.deepEqual(figures(calculate(lines)), [118, 0, 21.24, 10.62, 10.62, 139.24]);
  assert.deepEqual(figures(pricing.computeTotals(lines)), [118, 0, 21.24, 10.62, 10.62, 139.24]);
});

test('Line-level discount fields are unsupported and ignored by both calculators', function () {
  // The only implemented discount input is the order/cart coupon. This extra
  // property documents ignored input, not a supported line-discount contract.
  var lines = [item({ gstRate: 18, discount: 10 })];
  assert.deepEqual(figures(calculate(lines)), [100, 0, 18, 9, 9, 118]);
  assert.deepEqual(figures(pricing.computeTotals(lines)), [100, 0, 18, 9, 9, 118]);
  assert.equal(pricing.computeTotals(lines).lines[0].discount, 0);
});

test('Percentage coupon reduces invoice GST before tax, matching checkout', function () {
  // Regression: total remains 1062, but the old invoice reported discount
  // 118 and GST 180 instead of discount 100 and GST 162.
  var lines = [item({ price: 1000 })];
  assert.deepEqual(figures(calculate(lines, 'SAVE10')), [1000, 100, 162, 81, 81, 1062]);
  assert.deepEqual(figures(pricing.computeTotals(lines, 'SAVE10')), [1000, 100, 162, 81, 81, 1062]);
  assert.equal(pricing.discount(1000, 'SAVE10'), 100);
  assert.equal(coupons.calculateDiscount(1000, 'SAVE10'), 100);
});

test('Flat invoice coupon is applied before GST', function () {
  // Regression: the old after-tax FLAT50 path returned GST 72 and total
  // 422; invoice now matches checkout GST 63 and total 413.
  var lines = [item({ price: 400 })];
  assert.deepEqual(figures(calculate(lines, 'FLAT50')), [400, 50, 63, 31.5, 31.5, 413]);
  assert.deepEqual(figures(pricing.computeTotals(lines, 'FLAT50')), [400, 50, 63, 31.5, 31.5, 413]);
});

test('Invoice percentage discount respects the configured cap', function () {
  // Regression: old invoice discount 236 / GST 360 / total 2124 now
  // respects SAVE10 cap: discount 150 / GST 333 / total 2183.
  var lines = [item({ price: 2000 })];
  assert.deepEqual(figures(calculate(lines, 'SAVE10')), [2000, 150, 333, 166.5, 166.5, 2183]);
  assert.deepEqual(figures(pricing.computeTotals(lines, 'SAVE10')), [2000, 150, 333, 166.5, 166.5, 2183]);
  assert.equal(coupons.calculateDiscount(2000, 'SAVE10'), 150);
});

test('Invoice calculation ignores a coupon below its minimum subtotal', function () {
  // Regression: direct invoice calculation previously discounted 11.80
  // and returned 106.20. Creation still rejects this coupon without changes.
  var lines = [item()];
  assert.deepEqual(figures(calculate(lines, 'SAVE10')), [100, 0, 18, 9, 9, 118]);
  assert.deepEqual(figures(pricing.computeTotals(lines, 'SAVE10')), [100, 0, 18, 9, 9, 118]);
  assert.deepEqual(coupons.validate('SAVE10', 100), {
    valid: false, error: 'Coupon SAVE10 requires a minimum order subtotal of ₹500'
  });
});

test('Invoice calculation ignores an inactive coupon', function () {
  // Regression: old direct invoice calculation applied inactive DIWALI20,
  // returning discount 236 and total 944. Creation still rejects this code.
  // Historical configuration snapshots remain outside this fix.
  var lines = [item({ price: 1000 })];
  assert.deepEqual(figures(calculate(lines, 'DIWALI20')), [1000, 0, 180, 90, 90, 1180]);
  assert.deepEqual(figures(pricing.computeTotals(lines, 'DIWALI20')), [1000, 0, 180, 90, 90, 1180]);
  assert.deepEqual(coupons.validate('DIWALI20', 1000), {
    valid: false, error: 'Coupon DIWALI20 has expired'
  });
  assert.equal(coupons.getCoupon('DIWALI20'), null);
});

test('Invoice calculation normalizes coupon case and whitespace', function () {
  // Regression: direct invoice input previously lost the discount and
  // returned 1180. The order route already normalized codes before this fix.
  var lines = [item({ price: 1000 })];
  assert.equal(coupons.normalizeCode(' save10 '), 'SAVE10');
  assert.deepEqual(figures(calculate(lines, ' save10 ')), [1000, 100, 162, 81, 81, 1062]);
  assert.deepEqual(figures(pricing.computeTotals(lines, ' save10 ')), [1000, 100, 162, 81, 81, 1062]);
});

test('Coupon validation accepts no coupon and reports an unknown code exactly', function () {
  assert.deepEqual(coupons.validate('', 100), { valid: true, code: '', discount: 0 });
  assert.deepEqual(coupons.validate('NOTREAL', 1000), {
    valid: false, error: 'Invalid coupon code: NOTREAL'
  });
  assert.equal(coupons.getCoupon('NOTREAL'), null);
  assert.equal(coupons.calculateDiscount(100, 'NOTREAL'), 0);
});

test('Rounding helpers preserve observed half-paise, decimal and negative-zero results', function () {
  [tax.round2, pricing.round2].forEach(function (round2) {
    assert.equal(round2(0.005), 0.01);
    assert.equal(round2(0.0049), 0);
    assert.equal(round2(1.005), 1.01);
    assert.equal(round2(2.675), 2.68);
    assert.equal(round2(-0.005), -0);
  });
  var lines = [item({ price: 0.005 })];
  assert.deepEqual(figures(calculate(lines)), [0.01, 0, 0, 0, 0, 0.01]);
  assert.deepEqual(figures(pricing.computeTotals(lines)), [0.01, 0, 0, 0, 0, 0.01]);
});

test('Invoice and checkout round GST per line', function () {
  // Regression: old invoice GST 0.01 / total 0.07 now matches the two
  // rounded line taxes and checkout GST 0.02 / total 0.08.
  var lines = [item({ price: 0.03 }), item({ id: 2, price: 0.03 })];
  var actual = calculate(lines);
  var billed = pricing.computeTotals(lines);
  assert.deepEqual(figures(actual), [0.06, 0, 0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual(actual.rows.map(function (r) { return r.lineTax; }), [0.01, 0.01]);
  assert.equal(actual.rows.reduce(function (sum, r) { return sum + r.lineTax; }, 0), 0.02);
  assert.deepEqual(figures(billed), [0.06, 0, 0.02, 0.01, 0.01, 0.08]);
  assert.equal(billed.lines.reduce(function (sum, r) { return sum + r.net; }, 0), 0.08);
});

test('CURRENT BEHAVIOUR: two half-paise lines do not reconcile to either grand total', function () {
  // Likely correct: choose a rounding policy and allocate its residual so line
  // sums reconcile. Keeping today's aggregate total 0.01 requires line sum 0.01,
  // not 0.02; do not silently change either calculator in this test.
  var lines = [item({ price: 0.005 }), item({ id: 2, price: 0.005 })];
  var actual = calculate(lines);
  var billed = pricing.computeTotals(lines);
  assert.deepEqual(figures(actual), [0.01, 0, 0, 0, 0, 0.01]);
  assert.deepEqual(figures(billed), [0.01, 0, 0, 0, 0, 0.01]);
  assert.equal(actual.rows.reduce(function (sum, r) { return sum + r.line + r.lineTax; }, 0), 0.02);
  assert.equal(billed.lines.reduce(function (sum, r) { return sum + r.net; }, 0), 0.02);
});

test('CURRENT BEHAVIOUR: shared split components still have an exact binary float artifact', function () {
  // Invoice split changed from 0.07/0.08 to checkout's 0.08/0.07. The
  // remaining binary float artifact is unchanged: currency sum should be
  // 0.15, while exact Number addition is still 0.15000000000000002.
  var lines = [item({ price: 0.81 })];
  var actual = calculate(lines);
  var billed = pricing.computeTotals(lines);
  assert.deepEqual(figures(actual), [0.81, 0, 0.15, 0.08, 0.07, 0.96]);
  assert.deepEqual(figures(billed), [0.81, 0, 0.15, 0.08, 0.07, 0.96]);
  assert.equal(actual.cgst + actual.sgst, 0.15000000000000002);
  assert.equal(billed.cgst + billed.sgst, 0.15000000000000002);
});

test('CURRENT BEHAVIOUR: rounded coupon allocations exceed the cart discount by a paise', function () {
  // Likely correct: allocate exactly 50.00 across the lines, with a residual
  // adjustment. Today's line discounts sum to 50.01, and line nets fail to
  // reconcile to the returned 262.81 total. Invoice now shares this behavior.
  var lines = [item({ price: 100.1, hsn: '1006' }),
    item({ id: 2, price: 100.1, hsn: '1006' }),
    item({ id: 3, price: 100.1, hsn: '1006' })];
  var billed = pricing.computeTotals(lines, 'FLAT50');
  var actual = calculate(lines, 'FLAT50');
  assert.deepEqual(figures(billed), [300.3, 50, 12.51, 6.26, 6.25, 262.81]);
  assert.deepEqual(billed.lines.map(function (r) {
    return [r.gross, r.discount, r.taxable, r.tax, r.net];
  }), [[100.1, 16.67, 83.43, 4.17, 87.6],
    [100.1, 16.67, 83.43, 4.17, 87.6], [100.1, 16.67, 83.43, 4.17, 87.6]]);
  assert.equal(billed.lines.reduce(function (sum, r) { return sum + r.discount; }, 0), 50.010000000000005);
  assert.equal(billed.lines.reduce(function (sum, r) { return sum + r.net; }, 0), 262.79999999999995);
  assert.deepEqual(figures(actual), [300.3, 50, 12.51, 6.26, 6.25, 262.81]);
  assert.equal(actual.rows.reduce(function (sum, r) { return sum + r.line; }, 0), 300.29999999999995);
  assert.equal(actual.rows.reduce(function (sum, r) { return sum + r.lineTax; }, 0), 12.51);
});

test('Zero quantity and empty items return zero figures without calculator validation', function () {
  var lines = [item({ qty: 0 })];
  assert.deepEqual(figures(calculate(lines)), [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(figures(pricing.computeTotals(lines)), [0, 0, 0, 0, 0, 0]);
  assert.equal(calculate(lines).rows[0].qty, 0);
  assert.deepEqual(invoice.computeInvoiceFigures({}), {
    subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: []
  });
  assert.deepEqual(pricing.computeTotals([]), {
    subtotal: 0, discount: 0, taxable: 0, tax: 0,
    cgst: 0, sgst: 0, total: 0, lines: []
  });
});

test('Invoice and checkout agree for a fractional quantity', function () {
  // Regression: old invoice total 35.38 now matches rounded gross 29.99
  // plus GST 5.40, total 35.39. The order route still truncates quantities.
  var lines = [item({ price: 19.99, qty: 1.5 })];
  var actual = calculate(lines);
  assert.deepEqual(figures(actual), [29.99, 0, 5.4, 2.7, 2.7, 35.39]);
  assert.deepEqual(figures(pricing.computeTotals(lines)), [29.99, 0, 5.4, 2.7, 2.7, 35.39]);
  assert.equal(actual.rows[0].qty, 1.5);
  assert.equal(actual.rows[0].line + actual.rows[0].lineTax, 35.39);
});

test('Very large amounts retain the observed Number and paise values', function () {
  var lines = [item({ price: 999999999999.99, qty: 3 })];
  assert.deepEqual(figures(calculate(lines)), [2999999999999.97, 0,
    539999999999.99, 270000000000, 269999999999.99, 3539999999999.96]);
  assert.deepEqual(figures(pricing.computeTotals(lines)), [2999999999999.97, 0,
    539999999999.99, 270000000000, 269999999999.99, 3539999999999.96]);
});

test('Billed values survive orders.add/get and flow into reconciliation and rendered HTML', function () {
  var lines = [item({ name: 'Rice', sku: 'R-1', hsn: '1006' })];
  var totals = pricing.computeTotals(lines, '');
  var db = { nextOrderId: 1, orders: [], products: [], customers: [] };
  var order = orders.add(db, Object.assign({
    items: lines, date: '01/01/2022', customer: 'Synthetic', coupon: ''
  }, totals));
  assert.deepEqual(order, {
    id: 1, date: '01/01/2022', customer: 'Synthetic', customerId: null,
    paymentMode: 'cash', status: 'completed', items: lines, coupon: '',
    subtotal: 100, discount: 0, tax: 5, total: 105
  });
  assert.equal(db.nextOrderId, 2);
  assert.equal(orders.get(db, 1).total, 105);
  assert.equal(orders.get(db, 99), null);
  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{ orderId: 1, date: '01/01/2022', customer: 'Synthetic', coupon: '',
      ledgerSubtotal: 100, ledgerDiscount: 0, ledgerTax: 5, ledgerTotal: 105,
      invoiceDiscount: 0, invoiceTax: 5, invoiceTotal: 105, delta: 0, matched: true }]
  });
  var html = invoice.render(order);
  assert.equal(html.includes('Accountant Reconciliation Notice:'), false);
  assert.equal(html.includes('CGST + SGST (Total GST)</td><td class="r">₹5.00'), true);
  assert.equal(html.includes('Invoice Total</td><td class="r">₹105.00'), true);
  assert.deepEqual(reports.getDashboardSummary(db), {
    grossRevenue: 105, totalTaxCollected: 5, totalDiscountGiven: 0,
    totalOrders: 1, activeOrdersCount: 1, pendingCount: 0, cancelledCount: 0,
    totalKhataReceivable: 0,
    inventory: { totalSkus: 0, outOfStockCount: 0, lowStockCount: 0, totalValuation: 0 },
    reconciliationMismatchCount: 0, reconciliationTotalDelta: 0
  });
});

test('Invoice and reconciliation agree on coupon GST even when old totals already matched', function () {
  // Regression: old invoice GST 180 disagreed with billed GST 162 despite
  // equal totals. Shared calculation removes this fixture's discrepancy;
  // the renderer warning condition itself is deliberately unchanged.
  var order = {
    id: 2, date: '01/01/2022', customer: 'Synthetic', status: 'completed',
    items: [item({ name: 'Tea', price: 1000 })], coupon: 'SAVE10',
    subtotal: 1000, discount: 100, tax: 162, total: 1062
  };
  assert.deepEqual(reports.getGstReconciliation({ orders: [order] }), {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{ orderId: 2, date: '01/01/2022', customer: 'Synthetic', coupon: 'SAVE10',
      ledgerSubtotal: 1000, ledgerDiscount: 100, ledgerTax: 162, ledgerTotal: 1062,
      invoiceDiscount: 100, invoiceTax: 162, invoiceTotal: 1062, delta: 0, matched: true }]
  });
  assert.equal(invoice.render(order).includes('Accountant Reconciliation Notice:'), false);
});

test('HTML rendering escapes fixture text and formats amounts to two places', function () {
  var html = invoice.render({
    id: 3, date: '01/01/2022', customer: '<Synthetic & Co>', total: 118,
    items: [item({ name: '<Sample & Item>' })]
  });
  assert.equal(html.includes('&lt;Synthetic &amp; Co&gt;'), true);
  assert.equal(html.includes('&lt;Sample &amp; Item&gt;'), true);
  assert.equal(html.includes('Gross Subtotal</td><td class="r">₹100.00'), true);
  assert.equal(html.includes('Accountant Reconciliation Notice:'), false);
});

test('Calculation dependency graph never imports a persistent store or database', function () {
  assert.deepEqual(Object.keys(require.cache).filter(function (filename) {
    return /[\\/]lib[\\/]store\.js$/.test(filename) || /[\\/]data[\\/]/.test(filename);
  }), []);
});
