'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

test('invoice matches the amount billed by order pricing for HSN-rated, discounted items', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 2 }];
  var ledger = pricing.computeTotals(items, 'WELCOME');
  var bill = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.equal(bill.subtotal, ledger.subtotal);
  assert.equal(bill.discount, ledger.discount);
  assert.equal(bill.tax, ledger.tax);
  assert.equal(bill.total, ledger.total);
});

test('CURRENT BEHAVIOUR: invoice and order pricing both apply the HSN slab', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var ledger = pricing.computeTotals(items, '');
  var order = {
    id: 1001,
    items: items,
    coupon: '',
    subtotal: ledger.subtotal,
    discount: ledger.discount,
    tax: ledger.tax,
    total: ledger.total
  };
  var bill = invoice.computeInvoiceFigures(order);

  assert.equal(ledger.tax, 5);
  assert.equal(ledger.total, 105);
  assert.equal(bill.rows[0].gstPercent, 5);
  assert.equal(bill.tax, 5);
  assert.equal(bill.total, 105);
});

test('CURRENT BEHAVIOUR: invoice applies percent coupon and GST like order pricing', function () {
  var items = [{ id: 2, name: 'Packaged goods', hsn: '0902', price: 100, qty: 1 }];
  var ledger = pricing.computeTotals(items, 'WELCOME');
  var order = {
    id: 1002,
    items: items,
    coupon: 'WELCOME',
    subtotal: ledger.subtotal,
    discount: ledger.discount,
    tax: ledger.tax,
    total: ledger.total
  };
  var bill = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: ledger.discount, tax: ledger.tax, total: ledger.total },
    { discount: 5, tax: 17.1, total: 112.1 }
  );
  assert.deepEqual(
    { discount: bill.discount, tax: bill.tax, total: bill.total },
    { discount: 5, tax: 17.1, total: 112.1 }
  );
});

test('CURRENT BEHAVIOUR: invoice resolves HSN when gstRate is absent and supports stored gstRate', function () {
  var withStoredRate = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', hsn: '1006', gstRate: 5, price: 100, qty: 1 }]
  });
  var withoutStoredRate = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  });

  assert.equal(withStoredRate.tax, 5);
  assert.equal(withStoredRate.rows[0].gstPercent, 5);
  assert.equal(withoutStoredRate.tax, 5);
  assert.equal(withoutStoredRate.rows[0].gstPercent, 5);
});

test('CURRENT BEHAVIOUR: GST reconciliation matches ledger and invoice tax and totals', function () {
  var items = [{ id: 3, name: 'Packaged goods', hsn: '0902', price: 500, qty: 1 }];
  var ledger = pricing.computeTotals(items, 'SAVE10');
  var db = {
    orders: [{
      id: 1003,
      date: '2026-11-28',
      customer: 'Customer',
      items: items,
      coupon: 'SAVE10',
      subtotal: ledger.subtotal,
      discount: ledger.discount,
      tax: ledger.tax,
      total: ledger.total,
      status: 'completed'
    }]
  };

  var result = reports.getGstReconciliation(db);

  assert.equal(ledger.total, 531);
  assert.equal(result.rows[0].invoiceTotal, 531);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].ledgerTax, 81);
  assert.equal(result.rows[0].invoiceTax, 81);
  assert.equal(result.rows[0].matched, true);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
});

test('CURRENT BEHAVIOUR: rendered invoice shows billed totals without a mismatch notice', function () {
  var html = invoice.render({
    id: 1004,
    date: '2026-11-28',
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  });

  assert.match(html, /5%/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹5\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
