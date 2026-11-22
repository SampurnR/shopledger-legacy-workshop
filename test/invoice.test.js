// Run: node --test
// All fixtures live in memory; these modules do not import the JSON store.
var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var orders = require('../lib/orders');
var reports = require('../lib/reports');

function item(overrides) {
  return Object.assign({ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }, overrides);
}

function billedOrder(items, coupon) {
  var db = { nextOrderId: 1, orders: [] };
  return orders.add(db, Object.assign({ date: '2026-11-22', items: items, coupon: coupon },
    pricing.computeTotals(items, coupon)));
}

function amounts(figures) {
  return [figures.subtotal, figures.discount, figures.tax, figures.cgst, figures.sgst, figures.total];
}

test('invoice matches billed total and discounted HSN GST for SAVE10 rice order', function () {
  var order = billedOrder([item({ price: 500 })], 'SAVE10');
  assert.equal(order.total, 472.5);
  var calc = invoice.computeInvoiceFigures(order);
  assert.deepEqual(amounts(calc), [500, 50, 22.5, 11.25, 11.25, 472.5]);
  assert.equal(calc.rows[0].gstPercent, 5);
  assert.equal(calc.rows[0].lineTax, 22.5);
  assert.equal(invoice.render(order).includes('Accountant Reconciliation Notice:'), false);
});

test('empty invoice has zero totals and no rows', function () {
  assert.deepEqual(invoice.computeInvoiceFigures({}), {
    subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: []
  });
});

test('mixed HSN slabs produce the same GST breakdown on checkout and invoice', function () {
  var items = [item(), item({ id: 2, hsn: '0405' }), item({ id: 3, hsn: '0902' })];
  var checkout = pricing.computeTotals(items, '');
  var order = billedOrder(items, '');
  var calc = invoice.computeInvoiceFigures(order);
  assert.deepEqual(amounts(checkout), [300, 0, 35, 17.5, 17.5, 335]);
  assert.deepEqual(checkout.lines.map(function (line) { return line.tax; }), [5, 12, 18]);
  assert.deepEqual(amounts(calc), [300, 0, 35, 17.5, 17.5, 335]);
  assert.deepEqual(calc.rows[0], {
    name: 'Rice', sku: '-', hsn: '1006', qty: 1, price: 100,
    gstPercent: 5, line: 100, lineTax: 5
  });
  assert.equal(order.tax, 35);
  assert.equal(order.total, 335);
  assert.equal(Object.hasOwn(order, 'lines'), false);
});

[
  { name: 'explicit percentage overrides HSN in both calculators', rate: 12, checkout: 12, invoice: 12, percent: 12 },
  { name: 'decimal GST rates are respected by both calculators', rate: 0.05, checkout: 5, invoice: 5, percent: 5 },
  { name: 'explicit zero GST is respected by both calculators', rate: 0, checkout: 0, invoice: 0, percent: 0 },
  { name: 'string GST rates fall back to HSN in both calculators', rate: '12', checkout: 5, invoice: 5, percent: 5 }
].forEach(function (example) {
  test(example.name, function () {
    var items = [item({ gstRate: example.rate })];
    assert.equal(pricing.computeTotals(items, '').tax, example.checkout);
    var calc = invoice.computeInvoiceFigures({ items: items });
    assert.equal(calc.tax, example.invoice);
    assert.equal(calc.rows[0].gstPercent, example.percent);
  });
});

test('unknown HSN uses the default 18% in both calculators', function () {
  var items = [item({ hsn: 'unknown', qty: 2 })];
  assert.deepEqual(amounts(pricing.computeTotals(items, '')), [200, 0, 36, 18, 18, 236]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures({ items: items })), [200, 0, 36, 18, 18, 236]);
});

// Arrays are subtotal, discount, GST, CGST, SGST, total, in rupees.
[
  { name: 'percent discount reduces taxable value before GST', price: 500, code: 'SAVE10',
    checkout: [500, 50, 81, 40.5, 40.5, 531], invoice: [500, 50, 81, 40.5, 40.5, 531] },
  { name: 'flat discount reduces taxable value before GST', price: 500, code: 'FLAT50',
    checkout: [500, 50, 81, 40.5, 40.5, 531], invoice: [500, 50, 81, 40.5, 40.5, 531] },
  { name: 'invoice respects percentage discount cap', price: 2000, code: 'SAVE10',
    checkout: [2000, 150, 333, 166.5, 166.5, 2183], invoice: [2000, 150, 333, 166.5, 166.5, 2183] },
  { name: 'invoice respects minimum spend', price: 100, code: 'SAVE10',
    checkout: [100, 0, 18, 9, 9, 118], invoice: [100, 0, 18, 9, 9, 118] },
  { name: 'invoice ignores expired coupons', price: 1000, code: 'DIWALI20',
    checkout: [1000, 0, 180, 90, 90, 1180], invoice: [1000, 0, 180, 90, 90, 1180] },
  { name: 'invoice normalizes coupon codes', price: 500, code: ' save10 ',
    checkout: [500, 50, 81, 40.5, 40.5, 531], invoice: [500, 50, 81, 40.5, 40.5, 531] },
  { name: 'ineligible flat coupon does not make the invoice negative', price: 10, code: 'FLAT50',
    checkout: [10, 0, 1.8, 0.9, 0.9, 11.8], invoice: [10, 0, 1.8, 0.9, 0.9, 11.8] }
].forEach(function (example) {
  test(example.name, function () {
    // Direct calculation also covers historical orders that checkout validation rejects today.
    var items = [item({ price: example.price, hsn: '0902' })];
    assert.deepEqual(amounts(pricing.computeTotals(items, example.code)), example.checkout);
    assert.deepEqual(amounts(invoice.computeInvoiceFigures({ items: items, coupon: example.code })), example.invoice);
  });
});

test('unknown coupon gives no discount in either calculator', function () {
  var items = [item({ hsn: '0902' })];
  assert.deepEqual(amounts(pricing.computeTotals(items, 'UNKNOWN')), [100, 0, 18, 9, 9, 118]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures({ items: items, coupon: 'UNKNOWN' })), [100, 0, 18, 9, 9, 118]);
});

test('invoice sums rounded line GST consistently with checkout', function () {
  var items = [item({ price: 0.03, gstRate: 18 }), item({ price: 0.03, gstRate: 18 })];
  assert.deepEqual(amounts(pricing.computeTotals(items, '')), [0.06, 0, 0.02, 0.01, 0.01, 0.08]);
  var calc = invoice.computeInvoiceFigures({ items: items });
  assert.deepEqual(amounts(calc), [0.06, 0, 0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual(calc.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
});

test('CURRENT BEHAVIOUR: invoice recomputes figures and ignores stored monetary fields', function () {
  var order = billedOrder([item()], '');
  Object.assign(order, { subtotal: 999, discount: 888, tax: 777, total: 666 });
  var before = JSON.stringify(order);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), [100, 0, 5, 2.5, 2.5, 105]);
  assert.equal(JSON.stringify(order), before);
});

test('rendered invoice matches billing and still warns for a changed ledger total', function () {
  var order = billedOrder([item()], '');
  var html = invoice.render(order);
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹5.00'));
  assert.ok(html.includes('Invoice Total</td><td class="r">₹105.00'));
  assert.equal(html.includes('Accountant Reconciliation Notice:'), false);
  order.total = 104.99;
  assert.ok(invoice.render(order).includes('by +₹0.01.'));
  order.total = 105.01;
  assert.ok(invoice.render(order).includes('by -₹0.01.'));
  order.total = 105;
  assert.equal(invoice.render(order).includes('Accountant Reconciliation Notice:'), false);
});

test('percent coupon GST and total reconcile while cancelled orders remain excluded', function () {
  var order = billedOrder([item({ price: 500, hsn: '0902' })], 'SAVE10');
  assert.equal(invoice.render(order).includes('Accountant Reconciliation Notice:'), false);
  var cancelled = Object.assign({}, order, { id: 2, status: 'cancelled' });
  assert.deepEqual(reports.getGstReconciliation({ orders: [order, cancelled] }), {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{
      orderId: 1, date: '2026-11-22', customer: 'Walk-in', coupon: 'SAVE10',
      ledgerSubtotal: 500, ledgerDiscount: 50, ledgerTax: 81, ledgerTotal: 531,
      invoiceDiscount: 50, invoiceTax: 81, invoiceTotal: 531, delta: 0, matched: true
    }]
  });
});
