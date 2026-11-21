'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice applies the item HSN GST slab used by the order ledger', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var ledgerTotals = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items });

  assert.equal(ledgerTotals.tax, 5);
  assert.equal(ledgerTotals.total, 105);
  assert.deepEqual(
    { tax: invoiceFigures.tax, total: invoiceFigures.total, rowGst: invoiceFigures.rows[0].gstPercent },
    { tax: 5, total: 105, rowGst: 5 }
  );
});

test('invoice calculates GST on the discounted taxable line value', function () {
  var items = [{ id: 2, name: 'Packaged tea', hsn: '0902', price: 500, qty: 1 }];
  var ledgerTotals = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual(
    { discount: ledgerTotals.discount, tax: ledgerTotals.tax, total: ledgerTotals.total },
    { discount: 50, tax: 81, total: 531 }
  );
  assert.deepEqual(
    { discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { discount: 50, tax: 81, total: 531 }
  );
});

test('invoice applies percentage coupon to subtotal and respects its configured cap', function () {
  var items = [{ id: 3, name: 'Staples', hsn: '1006', price: 4000, qty: 1 }];
  var ledgerTotals = pricing.computeTotals(items, 'WHOLESALE15');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'WHOLESALE15' });

  assert.equal(ledgerTotals.discount, 400);
  assert.equal(invoiceFigures.discount, 400);
  assert.equal(invoiceFigures.tax, 180);
  assert.equal(invoiceFigures.total, 3780);
});

