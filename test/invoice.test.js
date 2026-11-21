var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice uses the product HSN GST slab when the order line has no gstRate', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('invoice uses the order discount and post-discount GST calculation', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 1000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'WELCOME');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.deepEqual(
    { discount: billed.discount, tax: billed.tax, total: billed.total },
    { discount: 50, tax: 47.5, total: 997.5 }
  );
  assert.deepEqual(
    { discount: figures.discount, tax: figures.tax, total: figures.total },
    { discount: billed.discount, tax: billed.tax, total: billed.total }
  );
});

test('invoice accepts fractional gstRate values consistently with order pricing', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Test item', price: 100, qty: 1, gstRate: 0.05 }],
    coupon: ''
  });

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
});

test('invoice GST and total match the order billing calculation', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.total, billed.total);
  assert.equal(figures.rows[0].gstPercent, billed.lines[0].gstPercent);
});
