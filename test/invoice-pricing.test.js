var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('Invoice uses the HSN rate billed on an order when gstRate is absent', function () {
  var items = [
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ];

  var billed = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(billed.subtotal, 100);
  assert.equal(billed.tax, 5);
  assert.equal(billed.cgst, 2.5);
  assert.equal(billed.sgst, 2.5);
  assert.equal(billed.total, 105);

  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.cgst, 2.5);
  assert.equal(invoiceFigures.sgst, 2.5);
  assert.equal(invoiceFigures.total, 105);
});

test('Invoice applies the same capped coupon discount and tax as the billed order', function () {
  var items = [
    { id: 2, name: 'Rice', sku: 'RICE-2', hsn: '1006', price: 1000, qty: 1 }
  ];

  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(billed.subtotal, 1000);
  assert.equal(billed.discount, 100);
  assert.equal(billed.tax, 45);
  assert.equal(billed.total, 945);

  assert.equal(invoiceFigures.subtotal, 1000);
  assert.equal(invoiceFigures.tax, 45);
  assert.equal(invoiceFigures.discount, 100);
  assert.equal(invoiceFigures.total, 945);
});

test('Reconciliation reports matched figures when the invoice reflects the billed order', function () {
  var items = [
    { id: 3, name: 'Rice', sku: 'RICE-3', hsn: '1006', price: 100, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, '');
  var db = {
    products: [],
    customers: [],
    orders: [{
      id: 9001,
      date: '01/01/2025',
      customer: 'Test Customer',
      coupon: '',
      status: 'completed',
      items: items,
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total
    }]
  };

  var result = reports.getGstReconciliation(db);

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 9001,
    date: '01/01/2025',
    customer: 'Test Customer',
    coupon: '',
    ledgerSubtotal: 100,
    ledgerDiscount: 0,
    ledgerTax: 5,
    ledgerTotal: 105,
    invoiceDiscount: 0,
    invoiceTax: 5,
    invoiceTotal: 105,
    delta: 0,
    matched: true
  });
  assert.equal(result.totalDelta, 0);
});

test('Invoice preserves an explicitly zero GST rate', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Zero-rated item', price: 100, qty: 1, gstRate: 0 }],
    coupon: ''
  });

  assert.equal(figures.tax, 0);
  assert.equal(figures.rows[0].gstPercent, 0);
});


test('Invoice matches the GST and total charged for an HSN-priced order', function () {
  var items = [
    { id: 4, name: 'Rice', sku: 'RICE-4', hsn: '1006', price: 1000, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.total, billed.total);
});

