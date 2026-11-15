var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

// Synthetic fixtures only: no store import, filesystem access, or application DB.
function line(id, price, qty, hsn) {
  return { id: id, sku: 'TEST-' + id, name: 'Test item ' + id, price: price, qty: qty, hsn: hsn };
}

function billedOrder(id, items, coupon, saved) {
  var totals = pricing.computeTotals(items, coupon || '');
  return Object.assign({
    id: id,
    date: '05/01/2022',
    customer: 'Synthetic Customer',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  }, saved || {});
}

test('Ticket invoice matches billed totals and discounted 5-percent line taxes', function () {
  var items = [line(1, 640, 1, '1006'), line(2, 190, 2, '1512')];
  var order = billedOrder(1002, items, 'SAVE10');
  assert.deepEqual([order.subtotal, order.discount, order.tax, order.total], [1020, 102, 45.9, 963.9]);
  var figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures, {
    subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9,
    rows: [
      { name: 'Test item 1', sku: 'TEST-1', hsn: '1006', qty: 1, price: 640, gstPercent: 5, line: 640, lineTax: 28.8 },
      { name: 'Test item 2', sku: 'TEST-2', hsn: '1512', qty: 2, price: 190, gstPercent: 5, line: 380, lineTax: 17.1 }
    ]
  });
});

test('Mixed-slab invoice follows checkout discount allocation and GST split', function () {
  var items = [line(1, 260, 1, '0405'), line(2, 140, 1, '0902')];
  var checkout = pricing.computeTotals(items, 'FLAT50');
  assert.deepEqual(checkout.lines, [
    { id: 1, name: 'Test item 1', hsn: '0405', gstPercent: 12, gross: 260, discount: 32.5, taxable: 227.5, tax: 27.3, net: 254.8 },
    { id: 2, name: 'Test item 2', hsn: '0902', gstPercent: 18, gross: 140, discount: 17.5, taxable: 122.5, tax: 22.05, net: 144.55 }
  ]);
  assert.deepEqual([checkout.tax, checkout.cgst, checkout.sgst, checkout.total], [49.35, 24.68, 24.67, 399.35]);
  var figures = invoice.computeInvoiceFigures(billedOrder(43, items, 'FLAT50'));
  assert.deepEqual([figures.discount, figures.tax, figures.cgst, figures.sgst, figures.total], [50, 49.35, 24.68, 24.67, 399.35]);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [27.3, 22.05]);
});

test('GST Audit matches ticket invoice and ledger figures without changing the billed order', function () {
  var db = { orders: [billedOrder(1002, [line(1, 640, 1, '1006'), line(2, 190, 2, '1512')], 'SAVE10')] };
  var before = structuredClone(db);
  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{
      orderId: 1002, date: '05/01/2022', customer: 'Synthetic Customer', coupon: 'SAVE10',
      ledgerSubtotal: 1020, ledgerDiscount: 102, ledgerTax: 45.9, ledgerTotal: 963.9,
      invoiceDiscount: 102, invoiceTax: 45.9, invoiceTotal: 963.9,
      delta: 0, matched: true
    }]
  });
  assert.deepEqual(db, before);
});

test('CURRENT BEHAVIOUR: GST Audit excludes cancelled orders but includes pending and matching orders', function () {
  var items = [line(1, 100, 1, '1006')];
  var db = { orders: [
    billedOrder(1, items, ''),
    billedOrder(2, items, '', { status: 'cancelled' }),
    billedOrder(3, items, '', { status: 'pending' }),
    billedOrder(4, [line(4, 100, 1, '0902')], '')
  ] };
  var result = reports.getGstReconciliation(db);
  assert.deepEqual([result.totalChecked, result.mismatchCount, result.totalDelta], [3, 0, 0]);
  assert.deepEqual(result.rows.map(function (row) { return [row.orderId, row.delta, row.matched]; }), [
    [1, 0, true], [3, 0, true], [4, 0, true]
  ]);
});

test('CURRENT BEHAVIOUR: GST Audit flags tax-only mismatch while printed invoice omits its notice', function () {
  var order = billedOrder(1, [line(1, 100, 1, '0902')], '', { tax: 0, total: 118 });
  var result = reports.getGstReconciliation({ orders: [order] });
  assert.deepEqual([result.totalChecked, result.mismatchCount, result.totalDelta], [1, 1, 0]);
  assert.equal(result.rows[0].ledgerTax, 0);
  assert.equal(result.rows[0].invoiceTax, 18);
  assert.equal(result.rows[0].matched, false);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice:/);
});

test('CURRENT BEHAVIOUR: GST Audit sums absolute total differences rather than netting them', function () {
  var items = [line(1, 100, 1, '0902')];
  var result = reports.getGstReconciliation({ orders: [
    billedOrder(1, items, '', { total: 108 }),
    billedOrder(2, items, '', { total: 128 })
  ] });
  assert.deepEqual(result.rows.map(function (row) { return row.delta; }), [10, -10]);
  assert.equal(result.mismatchCount, 2);
  assert.equal(result.totalDelta, 20);
});
