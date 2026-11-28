'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

test('invoice and checkout use the HSN rate when gstRate is absent', function () {
  var items = [{
    id: 1,
    name: 'Indrayani Basmati Rice 5kg',
    sku: 'GRN-001',
    hsn: '1006',
    price: 640,
    qty: 1
  }];

  var billed = pricing.computeTotals(items, '');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total },
    { subtotal: 640, discount: 0, tax: 32, cgst: 16, sgst: 16, total: 672 }
  );
  assert.deepEqual(
    { subtotal: invoiced.subtotal, discount: invoiced.discount, tax: invoiced.tax, cgst: invoiced.cgst, sgst: invoiced.sgst, total: invoiced.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total }
  );
  assert.equal(invoiced.rows[0].gstPercent, 5);
  assert.equal(invoiced.rows[0].lineTax, 32);
});

test('invoice applies percent coupon to the subtotal and honors the configured cap like checkout', function () {
  var items = [{
    id: 5,
    name: 'Cold-Pressed Groundnut Oil 5L',
    sku: 'OIL-002',
    hsn: '1508',
    price: 1120,
    qty: 2
  }];

  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 }
  );
  assert.deepEqual(
    { subtotal: invoiced.subtotal, discount: invoiced.discount, tax: invoiced.tax, total: invoiced.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total }
  );
});

test('invoice applies flat coupon discount before tax like checkout', function () {
  var items = [
    { id: 7, name: 'Pasteurized Table Butter 500g', sku: 'DRY-002', hsn: '0405', price: 260, qty: 1 },
    { id: 8, name: 'Assam CTC Masala Chai 250g', sku: 'BEV-001', hsn: '0902', price: 140, qty: 1 }
  ];

  var billed = pricing.computeTotals(items, 'FLAT50');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: 'FLAT50' });

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total },
    { subtotal: 400, discount: 50, tax: 49.35, cgst: 24.68, sgst: 24.67, total: 399.35 }
  );
  assert.deepEqual(
    { subtotal: invoiced.subtotal, discount: invoiced.discount, tax: invoiced.tax, cgst: invoiced.cgst, sgst: invoiced.sgst, total: invoiced.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total }
  );
});

test('invoice HTML shows the checkout GST amount and total without a mismatch notice', function () {
  var html = invoice.render({
    id: 1001,
    date: '01/01/2022',
    status: 'completed',
    items: [{ name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 }],
    coupon: '',
    total: 672
  });

  assert.match(html, /CGST \+ SGST \(Total GST\)/);
  assert.match(html, /<td class="r">5%<\/td><td class="r">₹32\.00<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹32\.00/);
  assert.doesNotMatch(html, /<td>CGST<\/td>|<td>SGST<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹672\.00/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});

test('GST reconciliation matches invoice calculations to stored checkout totals in memory', function () {
  var items = [{
    id: 1,
    name: 'Indrayani Basmati Rice 5kg',
    sku: 'GRN-001',
    hsn: '1006',
    price: 640,
    qty: 1
  }];
  var billed = pricing.computeTotals(items, '');
  var result = reports.getGstReconciliation({
    orders: [{
      id: 1001,
      date: '01/01/2022',
      customer: 'Walk-in',
      coupon: '',
      items: items,
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total
    }]
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].ledgerTotal, 672);
  assert.equal(result.rows[0].invoiceTotal, 672);
  assert.equal(result.rows[0].matched, true);
});
