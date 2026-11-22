var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function billedOrder(overrides) {
  var items = [{
    id: 1,
    name: 'Rice',
    sku: 'RICE-1',
    hsn: '1006',
    price: 100,
    qty: 1
  }];
  var totals = pricing.computeTotals(items, '');

  return Object.assign({
    id: 7,
    date: '2026-11-22',
    customer: 'Test customer',
    status: 'completed',
    paymentMode: 'cash',
    items: items,
    coupon: '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  }, overrides || {});
}

test('invoice uses the HSN slab and matches the stored order totals', function () {
  var order = billedOrder();
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 5);
  assert.equal(order.total, 105);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.cgst, 2.5);
  assert.equal(figures.sgst, 2.5);
  assert.equal(figures.total, order.total);
});

test('invoice applies the same percentage coupon rules and totals as order pricing', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, 'WELCOME');
  var order = billedOrder({
    coupon: 'WELCOME',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 5);
  assert.equal(order.tax, 4.75);
  assert.equal(order.total, 99.75);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
  assert.equal(figures.rows[0].lineTax, 4.75);
});

test('invoice resolves 5%, 12%, and 18% GST slabs for mixed HSN items', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 100, qty: 1 },
    { id: 3, name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ];
  var totals = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures(Object.assign({ items: items }, totals));

  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [5, 12, 18]);
  assert.equal(figures.tax, 35);
  assert.equal(figures.total, 335);
});

test('invoice follows coupon minimum, cap, inactive, and flat discount rules', function () {
  [
    { coupon: 'SAVE10', price: 400, expectedDiscount: 0 },
    { coupon: 'SAVE10', price: 2000, expectedDiscount: 150 },
    { coupon: 'DIWALI20', price: 1500, expectedDiscount: 0 },
    { coupon: 'FLAT50', price: 400, expectedDiscount: 50 }
  ].forEach(function (scenario) {
    var items = [{ id: 1, name: 'Rice', hsn: '1006', price: scenario.price, qty: 1 }];
    var totals = pricing.computeTotals(items, scenario.coupon);
    var order = Object.assign({ items: items, coupon: scenario.coupon }, totals);
    var figures = invoice.computeInvoiceFigures(order);

    assert.equal(figures.discount, scenario.expectedDiscount, scenario.coupon + ' discount');
    assert.equal(figures.total, totals.total, scenario.coupon + ' total');
  });
});

test('GST reconciliation reports the invoice versus ledger mismatch from in-memory order data', function () {
  var order = billedOrder();
  var result = reports.getGstReconciliation({ orders: [order], products: [], customers: [] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].ledgerTax, 5);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[0].ledgerTotal, 105);
  assert.equal(result.rows[0].invoiceTotal, 105);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});

test('rendered invoice shows billed totals without a mismatch notice', function () {
  var html = invoice.render(billedOrder());

  assert.match(html, /GST Amt<\/th>/);
  assert.match(html, /5%/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});
