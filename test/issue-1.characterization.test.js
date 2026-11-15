var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');
var coupons = require('../lib/coupons');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

// Synthetic fixtures only: no store import, filesystem access, or data/db.json.
function item(price, hsn, extra) {
  return Object.assign({ id: 1, name: 'Test item', sku: 'TEST', price: price, qty: 1, hsn: hsn }, extra);
}

function order(items, coupon, extra) {
  var totals = pricing.computeTotals(items, coupon);
  return Object.assign({ id: 1002, date: '05/01/2022', customer: 'Test customer',
    items: items, coupon: coupon || '', subtotal: totals.subtotal,
    discount: totals.discount, tax: totals.tax, total: totals.total }, extra);
}

test('checkout resolves HSN slabs, proportions discount, and splits rounded GST', function () {
  assert.deepEqual(pricing.computeTotals([
    item(500, '1006'), item(500, '0405', { id: 2 })
  ], 'SAVE10'), {
    subtotal: 1000, discount: 100, taxable: 900, tax: 76.5,
    cgst: 38.25, sgst: 38.25, total: 976.5,
    lines: [
      { id: 1, name: 'Test item', hsn: '1006', gstPercent: 5, gross: 500,
        discount: 50, taxable: 450, tax: 22.5, net: 472.5 },
      { id: 2, name: 'Test item', hsn: '0405', gstPercent: 12, gross: 500,
        discount: 50, taxable: 450, tax: 54, net: 504 }
    ]
  });
  assert.deepEqual(tax.splitCgstSgst(0.05), { cgst: 0.03, sgst: 0.02 });
});

test('REGRESSION: ticket 1002 invoice matches checkout HSN and post-discount GST', function () {
  var o = order([item(1020, '1006')], 'SAVE10');
  assert.equal(o.discount, 102);
  assert.equal(o.tax, 45.9);
  assert.equal(o.total, 963.9);
  assert.deepEqual(invoice.computeInvoiceFigures(o), {
    subtotal: 1020, discount: 102, tax: 45.9,
    cgst: 22.95, sgst: 22.95, total: 963.9,
    rows: [{ name: 'Test item', sku: 'TEST', hsn: '1006', qty: 1,
      price: 1020, gstPercent: 5, line: 1020, lineTax: 45.9 }]
  });
});

test('REGRESSION: ticket 1004 invoice respects SAVE10 cap and 5% oil HSN', function () {
  var o = order([item(2240, '1508')], 'SAVE10', { id: 1004 });
  assert.equal(o.discount, 150);
  assert.equal(o.tax, 104.5);
  assert.equal(o.total, 2194.5);
  var figures = invoice.computeInvoiceFigures(o);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 104.5);
  assert.equal(figures.total, 2194.5);
});

test('REGRESSION: invoice matches checkout for each HSN slab and fallback without coupons', function () {
  [['1006', 5, 105], ['0405', 12, 112], ['0902', 18, 118], ['', 18, 118]].forEach(function (row) {
    var o = order([item(100, row[0])]);
    assert.equal(o.tax, row[1]);
    assert.equal(o.total, row[2]);
    assert.equal(invoice.computeInvoiceFigures(o).tax, row[1]);
    assert.equal(invoice.computeInvoiceFigures(o).total, row[2]);
  });
});

test('REGRESSION: invoice shares checkout handling of percentage, decimal, zero and string GST rates', function () {
  [[5, 5, 5], [0.05, 5, 5], [0, 0, 0]].forEach(function (row) {
    var it = item(100, '0405', { gstRate: row[0] });
    assert.equal(pricing.computeTotals([it]).tax, row[1]);
    assert.equal(invoice.computeInvoiceFigures(order([it])).tax, row[2]);
  });
  assert.equal(tax.getRateForItem(item(100, '1006', { gstRate: '12' })), 0.05);
  assert.equal(invoice.computeInvoiceFigures(order([item(100, '1006', { gstRate: '12' })])).tax, 5);
});

test('checkout normalizes coupons, enforces minimums, and rejects inactive and unknown codes', function () {
  assert.equal(coupons.validate(' save10 ', 500).discount, 50);
  assert.deepEqual(coupons.validate('SAVE10', 499.99), {
    valid: false, error: 'Coupon SAVE10 requires a minimum order subtotal of ₹500'
  });
  assert.deepEqual(coupons.validate('DIWALI20', 2000), { valid: false, error: 'Coupon DIWALI20 has expired' });
  assert.deepEqual(coupons.validate('missing', 2000), { valid: false, error: 'Invalid coupon code: MISSING' });
  assert.deepEqual(coupons.validate('', 0), { valid: true, code: '', discount: 0 });
});

test('REGRESSION: invoice respects coupon minimum, active flag and normalization', function () {
  [['SAVE10', 100, 0], ['FLAT50', 10, 0], ['DIWALI20', 100, 0],
    [' save10 ', 1000, 100], ['missing', 1000, 0]].forEach(function (row) {
    var o = order([item(row[1], '0902')], row[0]);
    var figures = invoice.computeInvoiceFigures(o);
    assert.equal(figures.discount, row[2]);
    assert.equal(o.discount, row[0] === ' save10 ' ? 100 : 0);
    if (row[0] === 'FLAT50') assert.equal(figures.total, 11.8);
  });
});

test('REGRESSION: invoice sums rounded line GST like checkout', function () {
  var o = order([item(0.03, '0902'), item(0.03, '0902', { id: 2 })]);
  assert.equal(o.tax, 0.02);
  assert.equal(o.total, 0.08);
  var figures = invoice.computeInvoiceFigures(o);
  assert.deepEqual(figures.rows.map(function (r) { return r.lineTax; }), [0.01, 0.01]);
  assert.equal(figures.tax, 0.02);
  assert.equal(figures.total, 0.08);
  assert.equal(figures.cgst, 0.01);
  assert.equal(figures.sgst, 0.01);
});

test('empty checkout, invoice and reconciliation have zero figures', function () {
  assert.deepEqual(pricing.computeTotals([]), { subtotal: 0, discount: 0, taxable: 0,
    tax: 0, cgst: 0, sgst: 0, total: 0, lines: [] });
  assert.deepEqual(invoice.computeInvoiceFigures({}), { subtotal: 0, discount: 0,
    tax: 0, cgst: 0, sgst: 0, total: 0, rows: [] });
  assert.deepEqual(reports.getGstReconciliation({}), { totalChecked: 0, mismatchCount: 0, totalDelta: 0, rows: [] });
});

test('REGRESSION: reconciliation matches corrected invoice, includes pending and omits cancelled', function () {
  var o = order([item(1020, '1006')], 'SAVE10', { status: 'pending' });
  var db = { orders: [o, order([item(100, '0902')], '', { id: 1008 }),
    order([item(100, '1006')], '', { id: 1009, status: 'cancelled' })] };
  var before = JSON.stringify(db);
  var result = reports.getGstReconciliation(db);
  assert.equal(result.totalChecked, 2);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 1002, date: '05/01/2022', customer: 'Test customer', coupon: 'SAVE10',
    ledgerSubtotal: 1020, ledgerDiscount: 102, ledgerTax: 45.9, ledgerTotal: 963.9,
    invoiceDiscount: 102, invoiceTax: 45.9, invoiceTotal: 963.9,
    delta: 0, matched: true
  });
  assert.equal(result.rows[1].matched, true);
  assert.equal(JSON.stringify(db), before);
});

test('CURRENT BEHAVIOUR: reconciliation checks tax and total only and sums absolute total deltas', function () {
  var db = { orders: [
    order([item(100, '0902')], '', { total: 120 }),
    order([item(100, '0902')], '', { id: 2, total: 115 }),
    order([item(100, '0902')], '', { id: 3, tax: 17 }),
    order([item(100, '0902')], '', { id: 4, subtotal: 999, discount: 999 })
  ] };
  var result = reports.getGstReconciliation(db);
  assert.equal(result.mismatchCount, 3);
  assert.equal(result.totalDelta, 5);
  assert.deepEqual(result.rows.map(function (r) { return [r.delta, r.matched]; }),
    [[-2, false], [3, false], [0, false], [0, true]]);
});

test('REGRESSION: printed invoice displays corrected amounts without mutating order and retains mismatch notices', function () {
  var o = order([item(1020, '1006', { name: '<Oil & rice>' })], 'SAVE10');
  var before = JSON.stringify(o);
  var html = invoice.render(o);
  assert.ok(html.includes('&lt;Oil &amp; rice&gt;'));
  assert.ok(html.includes('₹963.90'));
  assert.ok(html.includes('₹45.90'));
  assert.ok(html.includes('-₹102.00'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
  assert.ok(invoice.render(Object.assign({}, o, { total: 960 })).includes('by +₹3.90'));
  assert.equal(JSON.stringify(o), before);
  assert.ok(!invoice.render(order([item(100, '0902')])).includes('Accountant Reconciliation Notice:'));
  assert.ok(invoice.render(order([item(100, '0902')], '', { total: 120 })).includes('by -₹2.00'));
});

test('CURRENT BEHAVIOUR: numeric string prices calculate but invoice rendering throws', function () {
  var o = order([item('100', '0902')]);
  assert.equal(o.total, 118);
  assert.equal(invoice.computeInvoiceFigures(o).total, 118);
  assert.throws(function () { invoice.render(o); }, { name: 'TypeError', message: 'r.price.toFixed is not a function' });
});
