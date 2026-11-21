var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('invoice reproduces the recorded order total and HSN GST breakdown', function () {
  var order = {
    id: 1002,
    items: [
      { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 },
      { id: 4, name: 'Sunflower Oil', sku: 'OIL-001', hsn: '1512', price: 190, qty: 2 }
    ],
    coupon: 'SAVE10',
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    total: 963.9
  };

  var figures = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);

  assert.equal(figures.subtotal, order.subtotal);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
  assert.deepEqual(figures.rows.map(function (row) { return [row.gstPercent, row.lineTax]; }), [
    [5, 28.8], [5, 17.1]
  ]);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('order pricing uses HSN GST and discounts subtotal before tax', function () {
  var items = [{ id: 7, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];

  var totals = pricing.computeTotals(items, '');

  assert.deepEqual({ subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total }, {
    subtotal: 100, discount: 0, tax: 5, total: 105
  });
  assert.equal(totals.lines[0].gstPercent, 5);
});

test('invoice without a stored gstRate uses the item HSN slab', function () {
  var order = {
    id: 1001,
    items: [{ id: 7, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: '',
    tax: 5,
    total: 105
  };

  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice coupon discount uses the subtotal basis and configured cap', function () {
  var order = {
    id: 1003,
    items: [{ id: 8, name: 'Rice', hsn: '1006', price: 3000, qty: 1 }],
    coupon: 'SAVE10',
    tax: 142.5,
    total: 2992.5
  };

  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 142.5);
  assert.equal(figures.total, 2992.5);
  assert.match(invoice.render(order), /Coupon Discount \(SAVE10\)/);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice honors an explicit gstRate stored on the order line', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', hsn: '1006', gstRate: 5, price: 100, qty: 1 }]
  });

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
});
