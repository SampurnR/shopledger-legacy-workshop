var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

test('invoice matches billed GST and total for discounted HSN rice', function () {
  var order = { id: 1, items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 6 }], coupon: 'WELCOME', subtotal: 600, discount: 30, tax: 28.5, total: 598.5 };
  var figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual({ discount: figures.discount, tax: figures.tax, total: figures.total, cgst: figures.cgst, sgst: figures.sgst }, { discount: 30, tax: 28.5, total: 598.5, cgst: 14.25, sgst: 14.25 });
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 28.5);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice:/);
  assert.match(invoice.render(order), /Invoice Total<\/td><td class="r">₹598\.50/);
});

test('invoice shares checkout coupon limits, GST rates and line rounding', function () {
  var pricing = require('../lib/pricing');
  var cases = [
    { items: [{ name: 'Rice', hsn: '1006', price: 2000, qty: 1 }], coupon: 'SAVE10' },
    { items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }], coupon: 'FLAT50' },
    { items: [{ name: 'Rice', hsn: '1006', price: 1500, qty: 1 }], coupon: 'DIWALI20' },
    { items: [{ name: 'Ghee', hsn: '0405', price: 300, qty: 1 }, { name: 'Tea', hsn: '0902', price: 200, qty: 1 }], coupon: 'FLAT50' },
    { items: [{ name: 'Zero', gstRate: 0, price: 100, qty: 1 }, { name: 'Decimal', gstRate: 0.05, price: 100, qty: 1 }, { name: 'Percent', gstRate: 5, price: 100, qty: 1 }] },
    { items: [{ name: 'A', price: 0.03, qty: 1 }, { name: 'B', price: 0.03, qty: 1 }] },
    { items: [] }
  ];
  cases.forEach(function (order) {
    var expected = pricing.computeTotals(order.items, order.coupon);
    var actual = invoice.computeInvoiceFigures(order);
    ['subtotal', 'discount', 'tax', 'cgst', 'sgst', 'total'].forEach(function (key) { assert.equal(actual[key], expected[key], key); });
    actual.rows.forEach(function (row, index) {
      assert.equal(row.gstPercent, expected.lines[index].gstPercent);
      assert.equal(row.lineTax, expected.lines[index].tax);
      assert.equal(row.line, expected.lines[index].gross);
    });
  });
});
