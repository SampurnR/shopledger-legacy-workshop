'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var config = require('../config');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice figures use the same HSN rates and coupon calculation as order billing', function () {
  // Mirrors the line shape built by routes/orders.js. No store or db.json is involved.
  var items = [
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 2 },
    { id: 2, name: 'Tea', sku: 'TEA', hsn: '0902', price: 100, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, 'WELCOME');
  var order = {
    id: 42,
    date: '2026-11-21',
    customer: 'A Customer',
    items: items,
    coupon: 'WELCOME',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
  var invoiced = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total },
    { subtotal: 300, discount: 15, tax: 26.6, cgst: 13.3, sgst: 13.3, total: 311.6 }
  );
  assert.deepEqual(
    { subtotal: invoiced.subtotal, discount: invoiced.discount, tax: invoiced.tax, cgst: invoiced.cgst, sgst: invoiced.sgst, total: invoiced.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total }
  );
  assert.deepEqual(invoiced.rows.map(function (row) { return row.gstPercent; }), [5, 18]);
});

test('invoice uses the recorded billed figures when current product tax rules have changed', function () {
  var order = {
    id: 43,
    items: [{ id: 3, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }],
    coupon: '',
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  };

  var originalRate = config.tax.hsnSlabs['1006'];
  try {
    config.tax.hsnSlabs['1006'] = 18;
    var invoiced = invoice.computeInvoiceFigures(order);
    assert.deepEqual(
      { subtotal: invoiced.subtotal, discount: invoiced.discount, tax: invoiced.tax, cgst: invoiced.cgst, sgst: invoiced.sgst, total: invoiced.total },
      { subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105 }
    );
    assert.equal(invoiced.rows[0].lineTax, null);
    assert.equal(invoiced.rows[0].gstPercent, null);
    var html = invoice.render(order);
    assert.match(html, /class="r">&mdash;<\/td><td class="r">&mdash;<\/td>/);
    assert.match(html, /CGST<\/td><td class="r">₹2\.50/);
    assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
  } finally {
    config.tax.hsnSlabs['1006'] = originalRate;
  }
});

test('invoice preserves saved per-line GST snapshots when current pricing rules differ', function () {
  var order = {
    id: 44,
    items: [{
      id: 3,
      name: 'Rice',
      sku: 'RICE',
      hsn: '1006',
      price: 100,
      qty: 1,
      gstRate: 5,
      gstTaxable: 95,
      gstAmount: 4.75
    }],
    coupon: '',
    subtotal: 100,
    discount: 5,
    tax: 4.75,
    total: 99.75
  };
  var originalRate = config.tax.hsnSlabs['1006'];
  try {
    config.tax.hsnSlabs['1006'] = 18;
    var invoiced = invoice.computeInvoiceFigures(order);
    assert.equal(invoiced.total, 99.75);
    assert.equal(invoiced.tax, 4.75);
    assert.equal(invoiced.rows[0].gstPercent, 5);
    assert.equal(invoiced.rows[0].lineTax, 4.75);
  } finally {
    config.tax.hsnSlabs['1006'] = originalRate;
  }
});

test('invoice render shows matching ledger total and a split CGST and SGST breakdown', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var html = invoice.render({
    id: 7,
    date: '2026-11-21',
    customer: 'A Customer',
    items: items,
    coupon: '',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });

  assert.match(html, /GST %<\/th>/);
  assert.match(html, /5%/);
  assert.match(html, /CGST<\/td><td class="r">₹2\.50/);
  assert.match(html, /SGST<\/td><td class="r">₹2\.50/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});

test('GST reconciliation matches invoice figures to the billed order', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var recon = reports.getGstReconciliation({
    orders: [{
      id: 9,
      date: '2026-11-21',
      customer: 'A Customer',
      items: items,
      coupon: '',
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total
    }]
  });

  assert.equal(recon.totalChecked, 1);
  assert.equal(recon.mismatchCount, 0);
  assert.equal(recon.totalDelta, 0);
  assert.equal(recon.rows[0].ledgerTax, 5);
  assert.equal(recon.rows[0].invoiceTax, 5);
  assert.equal(recon.rows[0].delta, 0);
  assert.equal(recon.rows[0].matched, true);
});
