var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice figures match the totals charged to the customer', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'WELCOME');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME', total: billed.total });

  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total }
  );
});

test('invoice applies percentage coupon and GST using the billed order calculation', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'WELCOME');
  var order = {
    id: 7,
    items: items,
    coupon: 'WELCOME',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };

  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 1000, discount: 50, tax: 47.5, total: 997.5 }
  );
  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total }
  );
  assert.doesNotMatch(invoice.render(order), /differs from Order Ledger recorded total/);
});

test('invoice interprets decimal gstRate like the billed order calculation', function () {
  var items = [{ name: 'Item', price: 100, qty: 1, gstRate: 0.05 }];
  var billed = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({ items: items });

  assert.equal(billed.tax, 5);
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('invoice uses the billed order HSN slab when no gstRate is stored', function () {
  var items = [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({ items: items });

  assert.equal(billed.tax, 5);
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('invoice line GST and GST total use billed per-line rounding', function () {
  var order = {
    items: [
      { name: 'A', price: 0.05, qty: 1, gstRate: 10 },
      { name: 'B', price: 0.05, qty: 1, gstRate: 10 }
    ]
  };

  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.equal(figures.tax, 0.02);
  assert.equal(figures.cgst, 0.01);
  assert.equal(figures.sgst, 0.01);
});
