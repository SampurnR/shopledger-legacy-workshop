var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

test('invoice and checkout apply the same HSN slab', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    sku: 'RICE-1',
    hsn: '1006',
    price: 100,
    qty: 2
  }];
  var checkout = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual({
    subtotal: checkout.subtotal,
    tax: checkout.tax,
    cgst: checkout.cgst,
    sgst: checkout.sgst,
    total: checkout.total,
    gstPercent: checkout.lines[0].gstPercent
  }, {
    subtotal: 200,
    tax: 10,
    cgst: 5,
    sgst: 5,
    total: 210,
    gstPercent: 5
  });
  assert.deepEqual({
    subtotal: invoiceFigures.subtotal,
    tax: invoiceFigures.tax,
    cgst: invoiceFigures.cgst,
    sgst: invoiceFigures.sgst,
    total: invoiceFigures.total,
    gstPercent: invoiceFigures.rows[0].gstPercent
  }, {
    subtotal: 200,
    tax: 10,
    cgst: 5,
    sgst: 5,
    total: 210,
    gstPercent: 5
  });
});

test('invoice and checkout discount taxable value before GST', function () {
  var items = [{
    id: 2,
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 6
  }];
  var checkout = pricing.computeTotals(items, 'WELCOME');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.deepEqual({ discount: checkout.discount, tax: checkout.tax, total: checkout.total }, {
    discount: 30,
    tax: 28.5,
    total: 598.5
  });
  assert.deepEqual({ discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total }, {
    discount: 30,
    tax: 28.5,
    total: 598.5
  });
});

test('reconciliation matches invoice totals and GST to the stored order', function () {
  var order = {
    id: 7,
    date: '2021-11-15',
    customer: 'Walk-in',
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 2 }],
    coupon: '',
    subtotal: 200,
    discount: 0,
    tax: 10,
    total: 210
  };
  var result = reports.getGstReconciliation({ orders: [order], customers: [] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual({
    ledgerTax: result.rows[0].ledgerTax,
    invoiceTax: result.rows[0].invoiceTax,
    ledgerTotal: result.rows[0].ledgerTotal,
    invoiceTotal: result.rows[0].invoiceTotal,
    delta: result.rows[0].delta,
    matched: result.rows[0].matched
  }, {
    ledgerTax: 10,
    invoiceTax: 10,
    ledgerTotal: 210,
    invoiceTotal: 210,
    delta: 0,
    matched: true
  });
});
