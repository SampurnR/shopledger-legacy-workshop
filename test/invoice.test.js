var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');
var reports = require('../lib/reports');
var store = require('../lib/store');
var orderRouter = require('../routes/orders');

// Synthetic fixtures only. Importing store does not read the database; the one
// route test replaces both persistence entry points before invoking its handler.
function item(overrides) {
  return Object.assign({ id: 1, name: 'Test item', sku: 'TEST-1', price: 100, qty: 1 }, overrides);
}

function billedOrder(items, coupon, overrides) {
  var totals = pricing.computeTotals(items, coupon || '');
  return Object.assign({
    id: 1001, date: '22/11/2026', customer: 'Test customer',
    status: 'completed', paymentMode: 'cash', items: items, coupon: coupon || '',
    subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total
  }, overrides);
}

function amounts(figures) {
  return [figures.subtotal, figures.discount, figures.tax, figures.cgst, figures.sgst, figures.total];
}

test('unknown HSN without a coupon uses the same 18% fallback for billing and invoice', function () {
  var order = billedOrder([item({ hsn: 'UNKNOWN' })]);
  assert.deepEqual(amounts(pricing.computeTotals(order.items, '')), [100, 0, 18, 9, 9, 118]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), [100, 0, 18, 9, 9, 118]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice:/);
});

test('invoice uses the billed mixed 5%, 12%, and 18% HSN slabs', function () {
  var order = billedOrder([
    item({ hsn: '1006' }), item({ id: 2, hsn: '0405' }), item({ id: 3, hsn: '0902' })
  ]);
  var billed = pricing.computeTotals(order.items, '');
  var printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(amounts(billed), [300, 0, 35, 17.5, 17.5, 335]);
  assert.deepEqual(billed.lines.map(function (line) { return line.gstPercent; }), [5, 12, 18]);
  assert.deepEqual(amounts(printed), [300, 0, 35, 17.5, 17.5, 335]);
  assert.deepEqual(printed.rows.map(function (row) { return row.gstPercent; }), [5, 12, 18]);
});

test('billing allocates a flat coupon proportionally before calculating each HSN tax', function () {
  var billed = pricing.computeTotals([item({ price: 300, hsn: '1006' }), item({ id: 2, price: 200, hsn: '0405' })], 'FLAT50');
  assert.deepEqual(amounts(billed), [500, 50, 35.1, 17.55, 17.55, 485.1]);
  assert.deepEqual(billed.lines.map(function (line) {
    return [line.discount, line.taxable, line.tax, line.net];
  }), [[30, 270, 13.5, 283.5], [20, 180, 21.6, 201.6]]);
});

test('invoice percent discount and post-discount GST both match billing', function () {
  var order = billedOrder([item({ price: 1000 })], 'SAVE10');
  assert.deepEqual(amounts(pricing.computeTotals(order.items, order.coupon)), [1000, 100, 162, 81, 81, 1062]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), [1000, 100, 162, 81, 81, 1062]);
});

test('invoice respects the billed SAVE10 discount cap', function () {
  var order = billedOrder([item({ price: 2000 })], 'SAVE10');
  assert.deepEqual(amounts(pricing.computeTotals(order.items, order.coupon)), [2000, 150, 333, 166.5, 166.5, 2183]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), [2000, 150, 333, 166.5, 166.5, 2183]);
});

test('invoice calculates GST after the billed flat discount', function () {
  var order = billedOrder([item({ price: 500 })], 'FLAT50');
  assert.deepEqual(amounts(pricing.computeTotals(order.items, order.coupon)), [500, 50, 81, 40.5, 40.5, 531]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), [500, 50, 81, 40.5, 40.5, 531]);
});

test('invoice ignores below-minimum coupons like billing without creating a negative total', function () {
  // These represent supplied/historical records, not orders accepted by the route.
  var percent = billedOrder([item()], 'SAVE10');
  assert.equal(coupons.validate('SAVE10', 100).valid, false);
  assert.equal(percent.discount, 0);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(percent)), [100, 0, 18, 9, 9, 118]);
  var flat = billedOrder([item({ price: 20 })], 'FLAT50');
  assert.equal(coupons.validate('FLAT50', 20).valid, false);
  assert.equal(flat.total, 23.6);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(flat)), [20, 0, 3.6, 1.8, 1.8, 23.6]);
});

test('invoice ignores inactive coupons like billing', function () {
  var order = billedOrder([item({ price: 1000 })], 'DIWALI20');
  assert.equal(coupons.validate('DIWALI20', 1000).valid, false);
  assert.equal(order.total, 1180);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), [1000, 0, 180, 90, 90, 1180]);
});

test('invoice normalizes coupon codes like billing', function () {
  var order = billedOrder([item({ price: 1000 })], ' save10 ');
  assert.equal(coupons.validate(order.coupon, 1000).valid, true);
  assert.equal(order.total, 1062);
  assert.equal(invoice.computeInvoiceFigures(order).total, 1062);
  assert.equal(invoice.computeInvoiceFigures(order).discount, 100);
});

test('invoice handles decimal, zero, and percentage GST rates like billing', function () {
  var decimal = billedOrder([item({ gstRate: 0.05 })]);
  assert.equal(decimal.tax, 5);
  var printed = invoice.computeInvoiceFigures(decimal);
  assert.equal(printed.tax, 5);
  assert.equal(printed.total, 105);
  assert.equal(printed.rows[0].gstPercent, 5);
  var zero = billedOrder([item({ gstRate: 0 })]);
  assert.equal(zero.tax, 0);
  assert.equal(invoice.computeInvoiceFigures(zero).tax, 0);
  var percentage = billedOrder([item({ gstRate: 5 })]);
  assert.equal(percentage.tax, 5);
  assert.equal(invoice.computeInvoiceFigures(percentage).tax, 5);
});

test('invoice rounds line tax and CGST/SGST consistently with billing', function () {
  var order = billedOrder([item({ price: 0.03 }), item({ id: 2, price: 0.03 })]);
  assert.deepEqual(amounts(pricing.computeTotals(order.items, '')), [0.06, 0, 0.02, 0.01, 0.01, 0.08]);
  var printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(amounts(printed), [0.06, 0, 0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual(printed.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
});

test('CURRENT BEHAVIOUR: invoice recomputes amounts instead of using stored billing figures', function () {
  var order = billedOrder([item()], '', { subtotal: 700, discount: 30, tax: 90, total: 760 });
  var before = JSON.parse(JSON.stringify(order));
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), [100, 0, 18, 9, 9, 118]);
  assert.match(invoice.render(order), /Invoice Total<\/td><td class="r">₹118\.00/);
  assert.match(invoice.render(order), /by -₹642\.00/);
  assert.deepEqual(order, before);
});

test('rendered invoice shows billed HSN GST and total without a mismatch warning', function () {
  var html = invoice.render(billedOrder([item({ name: '<Rice & grain>', hsn: '1006' })]));
  assert.match(html, /&lt;Rice &amp; grain&gt;/);
  assert.match(html, /<td class="r">5%<\/td><td class="r">₹5\.00/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹5\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
});

test('CURRENT BEHAVIOUR: tax-only mismatches are reported but produce no invoice warning or total delta', function () {
  var order = billedOrder([item({ price: 1000 })], 'SAVE10', { tax: 161 });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice:/);
  assert.deepEqual(reports.getGstReconciliation({ orders: [order] }), {
    totalChecked: 1, mismatchCount: 1, totalDelta: 0,
    rows: [{
      orderId: 1001, date: '22/11/2026', customer: 'Test customer', coupon: 'SAVE10',
      ledgerSubtotal: 1000, ledgerDiscount: 100, ledgerTax: 161, ledgerTotal: 1062,
      invoiceDiscount: 100, invoiceTax: 162, invoiceTotal: 1062, delta: 0, matched: false
    }]
  });
});

test('reconciliation skips cancelled orders and sums absolute total differences', function () {
  var db = { orders: [
    billedOrder([item({ hsn: '1006' })], '', { total: 92 }),
    billedOrder([item({ price: 2000 })], 'SAVE10', { id: 1002, total: 2242 }),
    billedOrder([item()], '', { id: 1003, status: 'cancelled', total: 999 }),
    billedOrder([item()], '', { id: 1004 })
  ] };
  var before = JSON.parse(JSON.stringify(db));
  var result = reports.getGstReconciliation(db);
  assert.deepEqual([result.totalChecked, result.mismatchCount, result.totalDelta], [3, 2, 72]);
  assert.deepEqual(result.rows.map(function (row) { return [row.orderId, row.delta, row.matched]; }),
    [[1001, 13, false], [1002, -59, false], [1004, 0, true]]);
  assert.deepEqual(db, before);
});

test('CURRENT BEHAVIOUR: a one-paisa total mismatch triggers both warning and reconciliation', function () {
  var order = billedOrder([item()], '', { total: 117.99 });
  assert.match(invoice.render(order), /by \+₹0\.01/);
  var result = reports.getGstReconciliation({ orders: [order] });
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalDelta, 0.01);
});

test('created order and invoice agree on the stored HSN billing totals', function (t) {
  var db = {
    products: [item({ hsn: '1006', gstRate: 12, stock: 10 })],
    orders: [], customers: [], auditLog: [], nextOrderId: 1001
  };
  t.mock.method(store, 'read', function () { return db; });
  t.mock.method(store, 'write', function (value) { assert.equal(value, db); });
  var route = orderRouter.stack.find(function (layer) {
    return layer.route && layer.route.path === '/orders' && layer.route.methods.post;
  });
  var response = {
    statusCode: 200,
    status: function (code) { this.statusCode = code; return this; },
    json: function (body) { this.body = body; return this; }
  };
  route.route.stack[0].handle({ body: { items: [{ id: 1, qty: 1 }] } }, response);
  assert.equal(response.statusCode, 201);
  assert.equal(response.body, db.orders[0]);
  assert.deepEqual([response.body.subtotal, response.body.discount, response.body.tax, response.body.total], [100, 0, 5, 105]);
  assert.equal(response.body.items[0].hsn, '1006');
  assert.equal(Object.hasOwn(response.body.items[0], 'gstRate'), false);
  assert.equal(invoice.computeInvoiceFigures(response.body).total, 105);
  assert.equal(db.products[0].stock, 9);
  assert.equal(db.auditLog[0].action, 'ORDER_CREATED');
  assert.equal(store.read.mock.callCount(), 1);
  assert.equal(store.write.mock.callCount(), 1);
});
