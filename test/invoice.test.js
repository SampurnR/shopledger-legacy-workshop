var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice uses the HSN GST slab used by order pricing', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }];
  var orderTotals = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(orderTotals.tax, 5);
  assert.equal(orderTotals.total, 105);
  assert.equal(invoiceFigures.tax, orderTotals.tax);
  assert.equal(invoiceFigures.total, orderTotals.total);
});

test('invoice uses the order coupon discount and post-discount GST figures', function () {
  var items = [{ id: 1, name: 'Goods', hsn: '9999', price: 2000, qty: 1 }];
  var orderTotals = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(orderTotals.discount, 150);
  assert.equal(orderTotals.total, 2183);
  assert.equal(invoiceFigures.discount, orderTotals.discount);
  assert.equal(invoiceFigures.tax, orderTotals.tax);
  assert.equal(invoiceFigures.total, orderTotals.total);
});

test('invoice accepts normalized coupon codes', function () {
  var order = { items: [{ name: 'Goods', price: 500, qty: 1 }], coupon: 'save10' };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.discount, 50);
  assert.equal(figures.total, 531);
});
