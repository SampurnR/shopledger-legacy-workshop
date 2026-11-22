'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function orderFrom(items, coupon) {
  var totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 7001,
    date: '22/11/2026',
    customer: 'In-memory customer',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('Invoice matches order pricing for mixed HSN items with a coupon', function () {
  var items = [
    { id: 6, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 },
    { id: 7, name: 'Ghee', sku: 'GHEE-1', hsn: '0405', price: 500, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures(orderFrom(items, 'SAVE10'));

  assert.equal(printed.subtotal, billed.subtotal);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
  assert.equal(printed.total, billed.total);
  assert.deepEqual(printed.rows.map(function (line) {
    return { gstPercent: line.gstPercent, tax: line.lineTax };
  }), billed.lines.map(function (line) {
    return { gstPercent: line.gstPercent, tax: line.tax };
  }));
});

test('Invoice uses the same HSN GST figures as order pricing', function () {
  var items = [
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 2 },
    { id: 2, name: 'Ghee', sku: 'GHEE-1', hsn: '0405', price: 50, qty: 1 }
  ];
  var ledger = pricing.computeTotals(items, '');
  var billedOrder = orderFrom(items, '');
  var printed = invoice.computeInvoiceFigures(billedOrder);

  assert.equal(ledger.subtotal, 250);
  assert.equal(ledger.tax, 16);
  assert.equal(ledger.cgst, 8);
  assert.equal(ledger.sgst, 8);
  assert.equal(ledger.total, 266);

  assert.equal(printed.subtotal, 250);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.rows[1].gstPercent, 12);
  assert.equal(printed.tax, 16);
  assert.equal(printed.cgst, 8);
  assert.equal(printed.sgst, 8);
  assert.equal(printed.total, 266);

  var reconciliation = reports.getGstReconciliation({ orders: [billedOrder] });
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});

test('Invoice uses the order discount cap and taxes the discounted HSN value', function () {
  var items = [
    { id: 3, name: 'Bulk rice', sku: 'RICE-BULK', hsn: '1006', price: 2000, qty: 1 }
  ];
  var ledger = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures(orderFrom(items, 'SAVE10'));

  assert.equal(coupons.validate('SAVE10', 2000).discount, 150);
  assert.equal(ledger.discount, 150);
  assert.equal(ledger.tax, 92.5);
  assert.equal(ledger.total, 1942.5);

  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, 92.5);
  assert.equal(printed.discount, 150);
  assert.equal(printed.total, 1942.5);
});

test('Invoice follows pricing rules for an inactive coupon on a stored order', function () {
  var items = [
    { id: 4, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ];
  var storedOrder = orderFrom(items, 'DIWALI20');
  var printed = invoice.computeInvoiceFigures(storedOrder);

  assert.equal(coupons.validate('DIWALI20', 100).valid, false);
  assert.equal(printed.tax, 5);
  assert.equal(printed.discount, 0);
  assert.equal(printed.total, 105);
});

test('Printable invoice shows the same CGST and SGST split as order pricing', function () {
  var items = [
    { id: 5, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ];
  var html = invoice.render(orderFrom(items, ''));

  assert.match(html, /<tr><td>CGST<\/td><td class="r">[^<]*2\.50<\/td><\/tr>/);
  assert.match(html, /<tr><td>SGST<\/td><td class="r">[^<]*2\.50<\/td><\/tr>/);
  assert.doesNotMatch(html, /CGST \+ SGST \(Total GST\)/);
});
