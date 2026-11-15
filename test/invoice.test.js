var test = require('node:test');
var assert = require('node:assert/strict');
var tax = require('../lib/tax');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice uses the same HSN GST slab as checkout pricing', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  assert.equal(tax.getRateForItem(items[0]), 0.05);
  assert.equal(pricing.computeTotals(items, '').tax, 5);
  assert.equal(invoice.computeInvoiceFigures({ items: items }).tax, 5);
});

test('invoice coupon totals match checkout pricing', function () {
  var order = { coupon: 'WELCOME', items: [{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }] };
  var ledgerFigures = pricing.computeTotals(order.items, order.coupon);
  var invoiceFigures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    { subtotal: ledgerFigures.subtotal, discount: ledgerFigures.discount, tax: ledgerFigures.tax, total: ledgerFigures.total },
    { subtotal: 100, discount: 5, tax: 17.1, total: 112.1 }
  );
  assert.deepEqual(
    { subtotal: invoiceFigures.subtotal, discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { subtotal: 100, discount: 5, tax: 17.1, total: 112.1 }
  );
});

test('invoice renders separate CGST and SGST amounts', function () {
  var order = { id: 7, total: 118, items: [{ name: 'Item', price: 100, qty: 1 }] };
  var figures = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);
  assert.equal(figures.cgst, 9);
  assert.equal(figures.sgst, 9);
  assert.match(html, /CGST<\/td><td class="r">\u20b99\.00/);
  assert.match(html, /SGST<\/td><td class="r">\u20b99\.00/);
  assert.doesNotMatch(html, /CGST \+ SGST \(Total GST\)/);
});

test('GST reconciliation matches invoice figures to stored order figures in memory', function () {
  var db = {
    orders: [{
      id: 1, date: '2026-11-15', customer: 'Customer', coupon: '', subtotal: 100,
      discount: 0, tax: 5, total: 105,
      items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
    }],
    customers: [], products: []
  };
  var result = reports.getGstReconciliation(db);
  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].ledgerTax, 5);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[0].ledgerTotal, 105);
  assert.equal(result.rows[0].invoiceTotal, 105);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});

test('invoice renders the amount and HSN GST that the customer was billed', function () {
  var order = {
    id: 22, customer: 'Rice buyer', subtotal: 100, discount: 0, tax: 5, total: 105,
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  };
  var figures = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);
  assert.deepEqual(
    { recordedTax: order.tax, recordedTotal: order.total, invoiceTax: figures.tax, invoiceTotal: figures.total },
    { recordedTax: 5, recordedTotal: 105, invoiceTax: 5, invoiceTotal: 105 }
  );
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 5);
  assert.equal(figures.rows[0].line, 100);
  assert.match(html, /Invoice Total<\/td><td class="r">.*105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
