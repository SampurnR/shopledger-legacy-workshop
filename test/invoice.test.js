var assert = require('node:assert/strict');
var test = require('node:test');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function mixedOrder() {
  return {
    id: 1,
    coupon: 'SAVE10',
    subtotal: 3000,
    discount: 150,
    total: 3182.5,
    tax: 332.5,
    items: [
      { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 500, qty: 2 },
      { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 1000, qty: 1 },
      { id: 3, sku: 'TEA', name: 'Tea', hsn: '0902', price: 500, qty: 2 }
    ]
  };
}

test('invoice totals and line taxes match checkout for mixed GST slabs and a capped coupon', function () {
  var order = mixedOrder();
  var expected = pricing.computeTotals(order.items, order.coupon);
  var actual = invoice.computeInvoiceFigures(order);

  assert.equal(expected.subtotal, 3000);
  assert.equal(expected.discount, 150);
  assert.equal(expected.tax, 332.5);
  assert.equal(expected.total, 3182.5);
  assert.equal(expected.cgst, 166.25);
  assert.equal(expected.sgst, 166.25);

  assert.equal(actual.subtotal, expected.subtotal);
  assert.equal(actual.discount, expected.discount);
  assert.equal(actual.tax, expected.tax);
  assert.equal(actual.cgst, expected.cgst);
  assert.equal(actual.sgst, expected.sgst);
  assert.equal(actual.total, expected.total);
  assert.deepEqual(actual.rows.map(function (row) { return row.gstPercent; }), [5, 12, 18]);
  assert.deepEqual(actual.rows.map(function (row) {
    return [row.gstPercent, row.line, row.lineDiscount, row.taxable, row.lineTax];
  }), expected.lines.map(function (line) {
    return [line.gstPercent, line.gross, line.discount, line.taxable, line.tax];
  }));

  var reconciliation = reports.getGstReconciliation({ orders: [order] });
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});

test('rendered invoice shows the checkout discount and the CGST/SGST split', function () {
  var html = invoice.render(mixedOrder());

  assert.match(html, /CGST<\/td><td class="r">₹166\.25/);
  assert.match(html, /SGST<\/td><td class="r">₹166\.25/);
  assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td class="r"[^>]*>-₹150\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹3182\.50/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
