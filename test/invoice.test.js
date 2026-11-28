var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('invoice figures match the order ledger for HSN tax and coupon discount', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  var ledger = pricing.computeTotals(items, 'WELCOME');
  var order = { id: 1000, coupon: 'WELCOME', items: items, total: ledger.total };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, ledger.subtotal);
  assert.equal(figures.discount, ledger.discount);
  assert.equal(figures.tax, ledger.tax);
  assert.equal(figures.cgst, ledger.cgst);
  assert.equal(figures.sgst, ledger.sgst);
  assert.equal(figures.total, order.total);
  assert.equal(figures.rows[0].gstPercent, ledger.lines[0].gstPercent);
  assert.equal(figures.rows[0].lineTax, ledger.lines[0].tax);
  assert.doesNotMatch(invoice.render(order), /differs from Order Ledger recorded total/);
});

test('invoice applies the same HSN GST rate as the order ledger', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  var ledger = pricing.computeTotals(items, '');
  var order = { id: 1001, items: items, total: ledger.total };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(ledger.tax, 5);
  assert.equal(ledger.total, 105);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, ledger.tax);
  assert.equal(figures.total, ledger.total);
  assert.doesNotMatch(invoice.render(order), /differs from Order Ledger recorded total/);
});

test('invoice applies welcome coupon and tax using the order ledger calculation', function () {
  var items = [{ id: 2, name: 'Flour', sku: 'FLOUR-1', hsn: '1006', price: 100, qty: 1 }];
  var ledger = pricing.computeTotals(items, 'WELCOME');
  var order = { id: 1002, coupon: 'WELCOME', items: items, total: ledger.total };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(ledger.discount, 5);
  assert.equal(ledger.tax, 4.75);
  assert.equal(ledger.total, 99.75);
  assert.equal(figures.discount, ledger.discount);
  assert.equal(figures.tax, ledger.tax);
  assert.equal(figures.total, ledger.total);
  assert.doesNotMatch(invoice.render(order), /differs from Order Ledger recorded total/);
});

test('invoice GST line and CGST/SGST split match rounded order ledger values', function () {
  var order = {
    id: 1003,
    items: [{ id: 3, name: 'Item', price: 0.05, qty: 1, gstRate: 0.1 }]
  };
  var ledger = pricing.computeTotals(order.items, '');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.tax, ledger.tax);
  assert.equal(figures.cgst, ledger.cgst);
  assert.equal(figures.sgst, ledger.sgst);
  assert.equal(figures.rows[0].lineTax, ledger.lines[0].tax);
});
