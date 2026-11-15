var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');
var tax = require('../lib/tax');

test('CURRENT BEHAVIOUR: pricing applies the HSN slab and WELCOME discount to subtotal before GST', function () {
  var totals = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ], 'WELCOME');

  assert.deepEqual(totals, {
    subtotal: 100,
    discount: 5,
    taxable: 95,
    tax: 4.75,
    cgst: 2.38,
    sgst: 2.37,
    total: 99.75,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 100,
      discount: 5,
      taxable: 95,
      tax: 4.75,
      net: 99.75
    }]
  });
});

test('invoice uses the same HSN rate and subtotal coupon discount as order pricing', function () {
  var order = {
    items: [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }],
    coupon: 'WELCOME'
  };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 100,
    discount: 5,
    tax: 4.75,
    cgst: 2.38,
    sgst: 2.37,
    total: 99.75,
    rows: [{
      name: 'Rice',
      sku: 'RICE',
      hsn: '1006',
      qty: 1,
      price: 100,
      gstPercent: 5,
      line: 100,
      lineTax: 4.75
    }]
  });
});

test('invoice honors SAVE10 pricing cap and calculates GST on the discounted HSN taxable value', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];
  var order = { items: items, coupon: 'SAVE10' };
  var ledgerTotals = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(ledgerTotals.discount, 100);
  assert.equal(ledgerTotals.tax, 45);
  assert.equal(ledgerTotals.total, 945);
  assert.equal(invoiceFigures.discount, ledgerTotals.discount);
  assert.equal(invoiceFigures.tax, ledgerTotals.tax);
  assert.equal(invoiceFigures.total, ledgerTotals.total);
});

test('invoice preserves explicit percentage and zero GST rates from order pricing', function () {
  var figures = invoice.computeInvoiceFigures({ items: [
    { name: 'Explicit rate', price: 100, qty: 1, gstRate: 5 },
    { name: 'Zero rate', price: 100, qty: 1, gstRate: 0 }
  ] });

  assert.equal(figures.tax, 5);
  assert.deepEqual(figures.rows.map(function (row) {
    return { gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), [
    { gstPercent: 5, lineTax: 5 },
    { gstPercent: 0, lineTax: 0 }
  ]);
  assert.equal(tax.getRateForItem({ gstRate: 0 }), 0);
});

test('GST reconciliation matches invoice figures to stored ledger totals', function () {
  var item = { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 };
  var ledgerTotals = pricing.computeTotals([item], 'WELCOME');
  var db = {
    products: [],
    customers: [],
    orders: [{
      id: 17,
      date: '2026-11-15',
      customer: 'Customer',
      items: [item],
      coupon: 'WELCOME',
      subtotal: ledgerTotals.subtotal,
      discount: ledgerTotals.discount,
      tax: ledgerTotals.tax,
      total: ledgerTotals.total
    }]
  };

  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 17,
      date: '2026-11-15',
      customer: 'Customer',
      coupon: 'WELCOME',
      ledgerSubtotal: 100,
      ledgerDiscount: 5,
      ledgerTax: 4.75,
      ledgerTotal: 99.75,
      invoiceDiscount: 5,
      invoiceTax: 4.75,
      invoiceTotal: 99.75,
      delta: 0,
      matched: true
    }]
  });
});

test('rendered invoice shows the billed total and HSN GST rate', function () {
  var html = invoice.render({
    id: 1009,
    items: [{ name: 'Indrayani Basmati Rice 5kg', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 }],
    total: 672
  });

  assert.match(html, /<td class="r">5%<\/td>/);
  assert.match(html, /₹32\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹672\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
