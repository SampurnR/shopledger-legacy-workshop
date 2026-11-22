var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');
var coupons = require('../lib/coupons');

function item(price, hsn, gstRate) {
  return { id: 1, name: 'Fixture product', price: price, qty: 1, hsn: hsn, gstRate: gstRate };
}

function billedOrder(items, coupon) {
  var totals = pricing.computeTotals(items, coupon);
  return Object.assign({ id: 1, items: items, coupon: coupon || '' }, totals);
}

test('Invoice total and GST breakdown match the billed checkout figures', function () {
  var order = billedOrder([item(500, '1006'), item(500, '0405')], 'SAVE10');
  var printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    [printed.subtotal, printed.discount, printed.tax, printed.cgst, printed.sgst, printed.total],
    [1000, 100, 76.5, 38.25, 38.25, 976.5]
  );
  assert.deepEqual(printed.rows.map(function (row) { return row.lineTax; }), [22.5, 54]);
});

test('Invoice uses HSN slabs used at checkout', function () {
  var order = billedOrder([item(100, '1006'), item(100, '0405'), item(100, '0902')]);
  assert.deepEqual(order.lines.map(function (line) { return line.tax; }), [5, 12, 18]);
  assert.equal(order.tax, 35);
  assert.equal(order.total, 335);
  var printed = invoice.computeInvoiceFigures(order);
  assert.equal(printed.tax, 35);
  assert.equal(printed.total, 335);
  assert.deepEqual([printed.cgst, printed.sgst], [17.5, 17.5]);
  assert.deepEqual(printed.rows.map(function (row) { return row.gstPercent; }), [5, 12, 18]);
});

test('Unknown HSN and no coupon produce matching fallback totals', function () {
  var order = billedOrder([item(100, 'unknown')]);
  assert.equal(order.total, 118);
  assert.equal(invoice.computeInvoiceFigures(order).total, 118);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 0);
});

test('Percentage coupon matches both total and GST', function () {
  var order = billedOrder([item(1000, '0902')], 'SAVE10');
  assert.deepEqual([order.discount, order.tax, order.cgst, order.sgst, order.total], [100, 162, 81, 81, 1062]);
  var printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual([printed.discount, printed.tax, printed.cgst, printed.sgst, printed.total], [100, 162, 81, 81, 1062]);
  var recon = reports.getGstReconciliation({ orders: [order] });
  assert.equal(recon.mismatchCount, 0);
  assert.equal(recon.totalDelta, 0);
  assert.equal(recon.rows[0].matched, true);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('Invoice respects percentage discount cap', function () {
  var order = billedOrder([item(2000, '0902')], 'SAVE10');
  assert.deepEqual([order.discount, order.tax, order.total], [150, 333, 2183]);
  var printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [150, 333, 2183]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('Flat discount reduces invoice taxable value', function () {
  var order = billedOrder([item(500, '0902')], 'FLAT50');
  assert.deepEqual([order.discount, order.tax, order.total], [50, 81, 531]);
  var printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [50, 81, 531]);
  assert.match(invoice.render(order), /Invoice Total<\/td><td class="r">₹531\.00/);
  assert.match(invoice.render(order), /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹81\.00/);
});

test('Invoice follows checkout inactive and minimum coupon rules', function () {
  assert.equal(coupons.validate('DIWALI20', 1000).valid, false);
  assert.equal(coupons.validate('FLAT50', 10).valid, false);
  var expired = billedOrder([item(1000, '0902')], 'DIWALI20');
  assert.equal(expired.discount, 0);
  assert.equal(invoice.computeInvoiceFigures(expired).discount, 0);
  var small = billedOrder([item(10, '0902')], 'FLAT50');
  assert.equal(small.total, 11.8);
  assert.equal(invoice.computeInvoiceFigures(small).total, 11.8);
});

test('Invoice normalizes coupon case and whitespace', function () {
  var order = billedOrder([item(1000, '0902')], ' save10 ');
  assert.equal(order.discount, 100);
  assert.equal(invoice.computeInvoiceFigures(order).discount, 100);
  assert.equal(coupons.normalizeCode(order.coupon), 'SAVE10');
});

test('Invoice supports decimal, zero and percentage GST rates', function () {
  var decimal = billedOrder([item(100, '1006', 0.05)]);
  assert.equal(decimal.tax, 5);
  assert.equal(invoice.computeInvoiceFigures(decimal).tax, 5);
  var zero = billedOrder([item(100, '1006', 0)]);
  assert.equal(zero.tax, 0);
  assert.equal(invoice.computeInvoiceFigures(zero).tax, 0);
  var percent = billedOrder([item(100, '1006', 12)]);
  assert.equal(percent.tax, 12);
  assert.equal(invoice.computeInvoiceFigures(percent).tax, 12);
});

test('Invoice rounds each line consistently with checkout', function () {
  var order = billedOrder([item(0.03, '0902'), item(0.03, '0902')]);
  assert.deepEqual([order.tax, order.total], [0.02, 0.08]);
  var printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(printed.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total], [0.02, 0.01, 0.01, 0.08]);
});

test('CURRENT BEHAVIOUR: invoice recalculates figures independently of stored amounts', function () {
  var order = { id: 5, items: [item(100, '0902')], subtotal: 999, discount: 77, tax: 3, total: 925 };
  var printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual([printed.subtotal, printed.discount, printed.tax, printed.total], [100, 0, 18, 118]);
  var cancelled = Object.assign({}, order, { status: 'cancelled' });
  assert.equal(reports.getGstReconciliation({ orders: [cancelled] }).totalChecked, 0);
});

test('CURRENT BEHAVIOUR: order route drops catalog gstRate and persists HSN-based billed totals', function (t) {
  // Stub persistence before invoking the real route handler; no server or database file is used.
  var store = require('../lib/store');
  var db = { products: [Object.assign(item(100, '1006', 12), { stock: 10 })], orders: [], nextOrderId: 1 };
  t.mock.method(store, 'read', function () { return db; });
  var write = t.mock.method(store, 'write', function (saved) { assert.equal(saved, db); });
  var router = require('../routes/orders');
  var layer = router.stack.find(function (entry) { return entry.route && entry.route.path === '/orders' && entry.route.methods.post; });
  var response = { status: function (code) { this.code = code; return this; }, json: function (body) { this.body = body; return this; } };
  layer.route.stack[0].handle({ body: { items: [{ id: 1, qty: 1 }] } }, response);
  assert.equal(response.code, 201);
  assert.equal(write.mock.callCount(), 1);
  assert.equal(Object.hasOwn(response.body.items[0], 'gstRate'), false);
  assert.equal(response.body.tax, 5);
  assert.equal(response.body.total, 105);
  assert.equal(invoice.computeInvoiceFigures(response.body).total, 105);
});
