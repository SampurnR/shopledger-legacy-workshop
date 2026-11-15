var assert = require('node:assert/strict');
var test = require('node:test');
var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');

function billOrder(items, coupon) {
  var db = { nextOrderId: 1001, orders: [] };
  var totals = pricing.computeTotals(items, coupon);
  return orders.add(db, {
    date: '2021-11-15',
    items: items,
    coupon: coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
}

test('invoice agrees with billing for a default-rate sale without a coupon', function () {
  var order = billOrder([{ name: 'Tea', price: 100, qty: 2 }]);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.total, 236);
  assert.equal(figures.total, 236);
  assert.equal(figures.tax, 36);
  assert.equal(figures.cgst, 18);
  assert.equal(figures.sgst, 18);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice uses the billed HSN rate for each line', function () {
  var order = billOrder([
    { name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
  ]);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 22);
  assert.equal(order.total, 322);
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.hsn, row.gstPercent, row.lineTax];
  }), [['1006', 5, 10], ['0405', 12, 12]]);
  assert.equal(figures.tax, 22);
  assert.equal(figures.cgst, 11);
  assert.equal(figures.sgst, 11);
  assert.equal(figures.total, 322);

  var html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹22\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹322\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice applies the capped percentage discount before GST', function () {
  var order = billOrder([{ name: 'Tea', price: 2000, qty: 1 }], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.discount, order.tax, order.total], [150, 333, 2183]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [150, 333, 2183]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice adds rounded line taxes and splits the billed GST', function () {
  var order = billOrder([
    { name: 'First item', price: 0.03, qty: 1 },
    { name: 'Second item', price: 0.03, qty: 1 }
  ]);
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.tax, order.total], [0.02, 0.08]);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [0.02, 0.01, 0.01, 0.08]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice uses the billing interpretation of fractional and zero GST rates', function () {
  var order = billOrder([
    { name: 'Fractional rate', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Zero rate', price: 100, qty: 1, gstRate: 0 }
  ]);
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.tax, order.total], [5, 205]);
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.gstPercent, row.lineTax];
  }), [[5, 5], [0, 0]]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [5, 2.5, 2.5, 205]);
});

test('printable invoice matches the billed total and GST for four bags of rice with SAVE10', function () {
  var order = billOrder([{ name: 'Rice', hsn: '1006', price: 640, qty: 4 }], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.total, 2530.5);
  assert.equal(figures.total, order.total);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 120.5);
  assert.equal(figures.cgst, 60.25);
  assert.equal(figures.sgst, 60.25);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 120.5);

  var html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2530\.50/);
  assert.match(html, /Total GST\)<\/td><td class="r">₹120\.50/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
