var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('invoice matches the billed HSN GST breakdown and total for order 1002', function () {
  var order = {
    id: 1002,
    coupon: 'SAVE10',
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    total: 963.9,
    items: [
      { id: 1, name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
      { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
    ]
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, 1020);
  assert.equal(figures.discount, 102);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 28.8);
  assert.equal(figures.rows[1].gstPercent, 5);
  assert.equal(figures.rows[1].lineTax, 17.1);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.cgst, 22.95);
  assert.equal(figures.sgst, 22.95);
  assert.equal(figures.total, order.total);
});

test('invoice uses the billed HSN slab for GST', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, '');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(invoiced.rows[0].gstPercent, 5);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.total, billed.total);
});

test('invoice uses the billed coupon cap and calculates GST after discount', function () {
  var items = [
    { id: 2, name: 'Packaged tea', hsn: '0902', price: 2000, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(invoiced.discount, billed.discount);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.total, billed.total);
});

test('invoice has no reconciliation notice when its calculated total matches the billed total', function () {
  var order = {
    id: 42,
    date: '2021-12-01',
    customer: 'Walk-in',
    paymentMode: 'cash',
    status: 'completed',
    coupon: '',
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    total: 105
  };

  var html = invoice.render(order);

  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
