// Run with: node --test
// Pins checkout behaviour and issue #1 regressions. Remaining defects are
// labelled CURRENT BEHAVIOUR. No store or server is loaded; fixtures are in memory.
var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');
var coupons = require('../lib/coupons');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function item(id, hsn, price, qty) {
  return { id: id, name: 'Item ' + id, sku: 'SKU-' + id, hsn: hsn, price: price, qty: qty };
}

// Literal expectations are independent of the production calculators.
// Amount arrays contain subtotal, discount, tax, total, CGST, SGST.
function scenarios() {
  return [
    { id: 1001, coupon: '', items: [item(8, '0902', 140, 2), item(2, '0713', 165, 2)],
      billed: [610, 0, 66.9, 676.9, 33.45, 33.45] },
    { id: 1002, coupon: 'SAVE10', items: [item(1, '1006', 640, 1), item(4, '1512', 190, 2)],
      billed: [1020, 102, 45.9, 963.9, 22.95, 22.95] },
    { id: 1003, coupon: 'FLAT50', items: [item(7, '0405', 260, 1), item(8, '0902', 140, 1)],
      billed: [400, 50, 49.35, 399.35, 24.68, 24.67] },
    { id: 1004, coupon: 'SAVE10', items: [item(5, '1508', 1120, 2)],
      billed: [2240, 150, 104.5, 2194.5, 52.25, 52.25] },
    { id: 1005, coupon: 'FLAT50', items: [item(1, '1006', 640, 1), item(12, '2106', 180, 2)],
      billed: [1000, 50, 91.96, 1041.96, 45.98, 45.98] },
    { id: 1006, coupon: 'WELCOME', items: [item(6, '0405', 450, 2), item(9, '0901', 310, 1)],
      billed: [1210, 60.5, 155.61, 1305.11, 77.81, 77.8] },
    { id: 1007, coupon: '', status: 'pending', items: [item(6, '0405', 450, 2), item(4, '1512', 190, 2)],
      billed: [1280, 0, 127, 1407, 63.5, 63.5] },
    { id: 1008, coupon: '', items: [item(8, '0902', 140, 1), item(12, '2106', 180, 2)],
      billed: [500, 0, 90, 590, 45, 45] }
  ];
}

function orderFor(scenario) {
  return {
    id: scenario.id, date: '05/01/2022', customer: 'Test customer',
    status: scenario.status || 'completed', paymentMode: 'cash',
    items: scenario.items, coupon: scenario.coupon,
    subtotal: scenario.billed[0], discount: scenario.billed[1],
    tax: scenario.billed[2], total: scenario.billed[3]
  };
}

function amounts(result) {
  return [result.subtotal, result.discount, result.tax, result.total, result.cgst, result.sgst];
}

scenarios().forEach(function (scenario) {
  test('Order #' + scenario.id + ' invoice matches checkout figures', function () {
    var order = orderFor(scenario);
    var before = structuredClone(order);
    assert.deepEqual(amounts(pricing.computeTotals(order.items, order.coupon)), scenario.billed);
    assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), scenario.billed);
    assert.deepEqual(order, before, 'Calculating figures must not mutate the billed order');
  });
});

test('Checkout allocates SAVE10 before applying each line GST rate', function () {
  var result = pricing.computeTotals(scenarios()[1].items, 'SAVE10');
  assert.equal(result.taxable, 918);
  assert.deepEqual(result.lines, [
    { id: 1, name: 'Item 1', hsn: '1006', gstPercent: 5, gross: 640,
      discount: 64, taxable: 576, tax: 28.8, net: 604.8 },
    { id: 4, name: 'Item 4', hsn: '1512', gstPercent: 5, gross: 380,
      discount: 38, taxable: 342, tax: 17.1, net: 359.1 }
  ]);
});

test('Invoice rows use HSN rates and discounted GST while retaining gross line values', function () {
  assert.deepEqual(invoice.computeInvoiceFigures(orderFor(scenarios()[1])).rows, [
    { name: 'Item 1', sku: 'SKU-1', hsn: '1006', qty: 1, price: 640,
      gstPercent: 5, line: 640, lineTax: 28.8 },
    { name: 'Item 4', sku: 'SKU-4', hsn: '1512', qty: 2, price: 190,
      gstPercent: 5, line: 380, lineTax: 17.1 }
  ]);
});

test('Tax resolves configured HSN slabs, explicit rates and the fallback', function () {
  assert.equal(tax.getRateForItem({ hsn: '1006' }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: '0405' }), 0.12);
  assert.equal(tax.getRateForItem({ hsn: '0902' }), 0.18);
  assert.equal(tax.getRateForItem({ hsn: 'unknown' }), 0.18);
  assert.equal(tax.getRateForItem({ hsn: '1006', gstRate: 12 }), 0.12);
  assert.equal(tax.getRateForItem({ gstRate: 0.05 }), 0.05);
  assert.equal(tax.getRateForItem({ gstRate: 0 }), 0);
  assert.deepEqual(tax.splitCgstSgst(49.35), { cgst: 24.68, sgst: 24.67 });
});

test('CURRENT BEHAVIOUR: HSN lookup requires an exact key, not a prefix', function () {
  assert.equal(tax.getRateForItem({ hsn: '100630' }), 0.18);
});

test('Coupons normalise codes, enforce minimums and caps, and reject inactive codes', function () {
  var valid = coupons.validate(' save10 ', 2240);
  assert.equal(valid.valid, true);
  assert.equal(valid.code, 'SAVE10');
  assert.equal(valid.discount, 150);
  assert.equal(coupons.validate('SAVE10', 499).valid, false);
  assert.equal(coupons.validate('SAVE10', 500).discount, 50);
  assert.equal(coupons.validate('DIWALI20', 2000).valid, false);
  assert.equal(coupons.validate('UNKNOWN', 2000).valid, false);
  assert.deepEqual(coupons.validate('', 2000), { valid: true, code: '', discount: 0 });
});

test('Invoice applies explicit percentage rates after discount', function () {
  var line = Object.assign(item(1, '1006', 1000, 1), { gstRate: 5 });
  var order = { items: [line], coupon: 'SAVE10' };
  assert.deepEqual(amounts(pricing.computeTotals(order.items, order.coupon)), [1000, 100, 45, 945, 22.5, 22.5]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), [1000, 100, 45, 945, 22.5, 22.5]);
});

test('Invoice honours decimal and zero rates like checkout', function () {
  var line = Object.assign(item(1, '1006', 100, 1), { gstRate: 0.05 });
  assert.equal(pricing.computeTotals([line], '').tax, 5);
  assert.equal(invoice.computeInvoiceFigures({ items: [line] }).tax, 5);
  line.gstRate = 0;
  assert.equal(pricing.computeTotals([line], '').tax, 0);
  assert.equal(invoice.computeInvoiceFigures({ items: [line] }).tax, 0);
});

test('Invoice gives no discount for inactive or below-minimum coupons', function () {
  var line = item(1, '0902', 1000, 1);
  assert.equal(pricing.computeTotals([line], 'DIWALI20').discount, 0);
  assert.equal(invoice.computeInvoiceFigures({ items: [line], coupon: 'DIWALI20' }).discount, 0);
  line.price = 100;
  assert.equal(pricing.computeTotals([line], 'SAVE10').discount, 0);
  assert.equal(invoice.computeInvoiceFigures({ items: [line], coupon: 'SAVE10' }).discount, 0);
});

test('Invoice normalises coupon codes like checkout', function () {
  var items = [item(1, '0902', 1000, 1)];
  assert.equal(pricing.computeTotals(items, ' save10 ').discount, 100);
  assert.equal(invoice.computeInvoiceFigures({ items: items, coupon: ' save10 ' }).discount, 100);
});

test('CURRENT BEHAVIOUR: independently rounded line discounts exceed the cart discount', function () {
  var result = pricing.computeTotals([
    item(1, '1006', 0.1, 1), item(2, '1006', 0.1, 1), item(3, '1006', 0.1, 1)
  ], 'WELCOME');
  assert.equal(result.discount, 0.02);
  assert.deepEqual(result.lines.map(function (line) { return line.discount; }), [0.01, 0.01, 0.01]);
  assert.equal(result.total, 0.28);
  assert.deepEqual(result.lines.map(function (line) { return line.net; }), [0.09, 0.09, 0.09]);
});

test('All eight in-memory orders reconcile after sharing checkout calculations', function () {
  var db = { orders: scenarios().map(orderFor) };
  var before = structuredClone(db);
  var result = reports.getGstReconciliation(db);
  assert.equal(result.totalChecked, 8);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows.map(function (row) { return row.delta; }),
    [0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(result.rows.map(function (row) { return row.matched; }),
    [true, true, true, true, true, true, true, true]);
  assert.deepEqual(db, before);
});

test('Reconciliation excludes cancelled orders but includes pending orders', function () {
  var cancelled = orderFor(scenarios()[1]);
  cancelled.status = 'cancelled';
  var result = reports.getGstReconciliation({ orders: [cancelled, orderFor(scenarios()[6])] });
  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].orderId, 1007);
});

test('CURRENT BEHAVIOUR: a tax-only mismatch is flagged by audit but has no invoice warning', function () {
  var order = {
    id: 2001, items: [Object.assign(item(1, '1006', 1000, 1), { gstRate: 5 })],
    coupon: 'SAVE10', subtotal: 1000, discount: 100, tax: 44, total: 945
  };
  var result = reports.getGstReconciliation({ orders: [order] });
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].invoiceTax, 45);
  assert.equal(result.rows[0].matched, false);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice:/);
});

test('Printed HTML shows the billed GST, discount and total without a mismatch notice', function () {
  var html = invoice.render(orderFor(scenarios()[1]));
  assert.match(html, /Total GST\)<\/td><td class="r">\u20b945\.90/);
  assert.match(html, /Coupon Discount \(SAVE10\).*?-\u20b9102\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">\u20b9963\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
  assert.doesNotMatch(invoice.render(orderFor(scenarios()[7])), /Accountant Reconciliation Notice:/);
});

test('CURRENT BEHAVIOUR: invoice ignores stored financial totals when recomputing figures', function () {
  var order = orderFor(scenarios()[1]);
  order.subtotal = 1;
  order.discount = 2;
  order.tax = 3;
  order.total = 4;
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), [1020, 102, 45.9, 963.9, 22.95, 22.95]);
  assert.equal(order.total, 4);
  assert.match(invoice.render(order), /Accountant Reconciliation Notice:/);
});
