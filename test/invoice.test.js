'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('CURRENT BEHAVIOUR: invoice matches checkout HSN GST and billed totals', function () {
  var items = [{ id: 1, name: 'Dal', hsn: '0713', price: 100, qty: 1 }];
  var ledger = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(ledger.tax, 5);
  assert.equal(ledger.total, 105);
  assert.equal(ledger.lines[0].gstPercent, 5);
  assert.equal(printed.tax, ledger.tax);
  assert.equal(printed.total, ledger.total);
  assert.equal(printed.rows[0].gstPercent, ledger.lines[0].gstPercent);
});

test('CURRENT BEHAVIOUR: invoice honors checkout coupon caps and calculates GST after discount', function () {
  var items = [{ id: 1, name: 'Groundnut oil', hsn: '1508', price: 2240, qty: 1 }];
  var ledger = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(ledger.discount, 150);
  assert.equal(ledger.tax, 104.5);
  assert.equal(ledger.total, 2194.5);
  assert.equal(printed.discount, ledger.discount);
  assert.equal(printed.tax, ledger.tax);
  assert.equal(printed.total, ledger.total);
});

test('CURRENT BEHAVIOUR: invoice line GST reflects prorated discount while retaining equal CGST and SGST', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 10, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 10, qty: 1 }
  ];
  var ledger = pricing.computeTotals(items, 'WELCOME');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });
  var html = invoice.render({ id: 7, items: items, coupon: 'WELCOME', total: ledger.total });

  assert.deepEqual(printed.rows.map(function (row) { return row.gstPercent; }), [5, 18]);
  assert.deepEqual(printed.rows.map(function (row) { return row.lineTax; }), ledger.lines.map(function (line) { return line.tax; }));
  assert.equal(printed.tax, ledger.tax);
  assert.equal(printed.cgst, ledger.cgst);
  assert.equal(printed.sgst, ledger.sgst);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /CGST \+ SGST \(Total GST\)/);
  assert.match(html, /Invoice Total/);
});
