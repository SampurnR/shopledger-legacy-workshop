var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice uses the same HSN GST slab as the ledger when gstRate is omitted', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var ledgerFigures = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(ledgerFigures.tax, 5);
  assert.equal(ledgerFigures.total, 105);
  assert.equal(invoiceFigures.tax, ledgerFigures.tax);
  assert.equal(invoiceFigures.total, ledgerFigures.total);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
});

test('invoice interprets fractional gstRate consistently with the ledger', function () {
  var items = [{ name: 'Tea', gstRate: 0.05, price: 100, qty: 1 }];
  var ledgerFigures = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({ items: items });

  assert.equal(figures.tax, ledgerFigures.tax);
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('invoice uses the ledger coupon cap and calculates GST after discount', function () {
  var items = [{ name: 'Rice', hsn: '1006', price: 3000, qty: 1 }];
  var ledgerFigures = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(ledgerFigures.discount, 150);
  assert.equal(ledgerFigures.tax, 142.5);
  assert.equal(ledgerFigures.total, 2992.5);
  assert.equal(invoiceFigures.discount, ledgerFigures.discount);
  assert.equal(invoiceFigures.tax, ledgerFigures.tax);
  assert.equal(invoiceFigures.total, ledgerFigures.total);
  assert.equal(invoiceFigures.rows[0].lineTax, ledgerFigures.lines[0].tax);
});

test('invoice line tax reflects the allocated coupon discount', function () {
  var items = [{ name: 'Staples', gstRate: 5, price: 100, qty: 1 }];
  var ledgerFigures = pricing.computeTotals(items, 'WELCOME');
  var figures = invoice.computeInvoiceFigures({ coupon: 'WELCOME', items: items });

  assert.equal(figures.rows[0].lineTax, 4.75);
  assert.equal(figures.tax, ledgerFigures.tax);
  assert.equal(figures.discount, ledgerFigures.discount);
  assert.equal(figures.total, ledgerFigures.total);
});

test('GST reconciliation reports invoices balanced with the stored ledger', function () {
  var db = {
    products: [],
    customers: [],
    orders: [{
      id: 41,
      date: '2026-11-21',
      customer: 'In-memory customer',
      coupon: '',
      status: 'completed',
      items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
      subtotal: 100,
      discount: 0,
      tax: 5,
      total: 105
    }]
  };
  var result = reports.getGstReconciliation(db);

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[0].invoiceTotal, 105);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});

test('rendered invoice matches the ledger total without a reconciliation notice', function () {
  var html = invoice.render({
    id: 7,
    date: '2026-11-21',
    total: 105,
    coupon: '',
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  });

  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice must match ledger tax, coupon discount, and total', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 3000, qty: 1 }];
  var ledgerFigures = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.rows[0].lineTax, ledgerFigures.lines[0].tax);
  assert.equal(invoiceFigures.discount, ledgerFigures.discount);
  assert.equal(invoiceFigures.tax, ledgerFigures.tax);
  assert.equal(invoiceFigures.total, ledgerFigures.total);
});
