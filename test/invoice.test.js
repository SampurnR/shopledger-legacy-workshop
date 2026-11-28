var test = require('node:test');
var assert = require('node:assert/strict');
var db = require('../data/db.json');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function figures(items, coupon) {
  return invoice.computeInvoiceFigures({ items: items, coupon: coupon || '' });
}

test('invoice figures match recorded billing for orders #1001–#1008', function () {
  db.orders.forEach(function (order) {
    var result = invoice.computeInvoiceFigures(order);
    assert.equal(result.subtotal, order.subtotal, 'subtotal for #' + order.id);
    assert.equal(result.discount, order.discount, 'discount for #' + order.id);
    assert.equal(result.tax, order.tax, 'GST for #' + order.id);
    assert.equal(result.total, order.total, 'total for #' + order.id);
  });
});

test('GST reconciliation reports zero mismatches and zero delta', function () {
  var result = reports.getGstReconciliation(db);
  assert.equal(result.totalChecked, 8);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.ok(result.rows.every(function (row) { return row.matched; }));
});

test('invoice uses HSN slabs at 5%, 12%, and 18%', function () {
  var result = figures([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 100, qty: 1 },
    { id: 3, name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ]);
  assert.deepEqual(result.rows.map(function (row) { return row.gstPercent; }), [5, 12, 18]);
  assert.equal(result.tax, 35);
  assert.equal(result.cgst, 17.5);
  assert.equal(result.sgst, 17.5);
});

test('percentage coupon obeys its maximum discount and taxes the discounted taxable value', function () {
  var result = figures([
    { id: 1, name: 'Rice', hsn: '1006', price: 2240, qty: 1 }
  ], 'SAVE10');
  assert.equal(result.discount, 150);
  assert.equal(result.rows[0].taxable, 2090);
  assert.equal(result.rows[0].lineTax, 104.5);
  assert.equal(result.tax, 104.5);
  assert.equal(result.total, 2194.5);
});

test('flat coupon is apportioned before GST is calculated', function () {
  var result = figures([
    { id: 1, name: 'Butter', hsn: '0405', price: 260, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 140, qty: 1 }
  ], 'FLAT50');
  assert.equal(result.discount, 50);
  assert.deepEqual(result.rows.map(function (row) { return row.taxable; }), [227.5, 122.5]);
  assert.equal(result.tax, 49.35);
  assert.equal(result.total, 399.35);
});

test('invoice line taxable amounts and GST match checkout line breakdown', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 2, name: 'Concentrate', hsn: '2106', price: 180, qty: 2 }
  ];
  var expected = pricing.computeTotals(items, 'FLAT50');
  var actual = figures(items, 'FLAT50');
  assert.deepEqual(actual.rows.map(function (row) {
    return { taxable: row.taxable, lineTax: row.lineTax, gstPercent: row.gstPercent };
  }), expected.lines.map(function (line) {
    return { taxable: line.taxable, lineTax: line.tax, gstPercent: line.gstPercent };
  }));
});

test('coupon invoice line totals reconcile to post-discount taxable value plus GST', function () {
  var order = db.orders.filter(function (item) { return item.id === 1002; })[0];
  var result = invoice.computeInvoiceFigures(order);
  result.rows.forEach(function (row) {
    assert.equal(row.line, row.taxable + row.lineTax);
  });
  var html = invoice.render(order);
  assert.match(html, /<th class="r">Line Total<\/th>/);
  assert.doesNotMatch(html, /Line Gross/);
});
