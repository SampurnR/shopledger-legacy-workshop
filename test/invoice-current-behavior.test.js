var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('invoice figures match the totals charged by checkout', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 140, qty: 2 }
  ];
  var ledger = pricing.computeTotals(items, 'WELCOME');
  var order = {
    id: 1,
    items: items,
    coupon: 'WELCOME',
    subtotal: ledger.subtotal,
    discount: ledger.discount,
    tax: ledger.tax,
    total: ledger.total
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, ledger.subtotal);
  assert.equal(figures.discount, ledger.discount);
  assert.equal(figures.tax, ledger.tax);
  assert.equal(figures.cgst, ledger.cgst);
  assert.equal(figures.sgst, ledger.sgst);
  assert.equal(figures.total, ledger.total);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }),
    ledger.lines.map(function (line) { return line.tax; }));
});

test('invoice uses the HSN slab used by checkout', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var ledger = pricing.computeTotals(items, '');
  var order = {
    id: 1,
    items: items,
    subtotal: ledger.subtotal,
    discount: ledger.discount,
    tax: ledger.tax,
    total: ledger.total
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(ledger.tax, 5);
  assert.equal(ledger.total, 105);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, ledger.tax);
  assert.equal(figures.total, ledger.total);
});

test('invoice uses checkout percentage coupon and post-discount taxable values', function () {
  var items = [{ id: 2, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];
  var ledger = pricing.computeTotals(items, 'WELCOME');
  var order = {
    id: 2,
    items: items,
    coupon: 'WELCOME',
    subtotal: ledger.subtotal,
    discount: ledger.discount,
    tax: ledger.tax,
    total: ledger.total
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(ledger.discount, 50);
  assert.equal(ledger.tax, 47.5);
  assert.equal(ledger.total, 997.5);
  assert.equal(figures.discount, ledger.discount);
  assert.equal(figures.tax, ledger.tax);
  assert.equal(figures.total, ledger.total);
});

test('rendered invoice shows the charged total without a reconciliation warning', function () {
  var order = {
    id: 3,
    items: [{ name: 'Rice', sku: 'R-1', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  };
  var html = invoice.render(order);

  assert.match(html, /Invoice Total<\/td><td class="r">.105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
