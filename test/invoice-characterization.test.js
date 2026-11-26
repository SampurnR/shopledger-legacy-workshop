var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice figures match the customer-billed HSN GST total', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 1
  }];
  var ledger = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total
  }, {
    subtotal: ledger.subtotal,
    discount: ledger.discount,
    tax: ledger.tax,
    cgst: ledger.cgst,
    sgst: ledger.sgst,
    total: ledger.total
  });
});

test('invoice uses the HSN GST rate for an HSN-only rice line', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 1
  }];
  var ledger = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(ledger, {
    subtotal: 100,
    discount: 0,
    taxable: 100,
    tax: 5,
    cgst: 2.5,
    sgst: 2.5,
    total: 105,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 100,
      discount: 0,
      taxable: 100,
      tax: 5,
      net: 105
    }]
  });
  assert.deepEqual(figures, {
    subtotal: 100,
    discount: 0,
    tax: 5,
    cgst: 2.5,
    sgst: 2.5,
    total: 105,
    rows: [{
      name: 'Rice',
      sku: '-',
      hsn: '1006',
      qty: 1,
      price: 100,
      gstPercent: 5,
      line: 100,
      lineTax: 5
    }]
  });
});

test('invoice applies SAVE10 before tax and respects its cap', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 20
  }];
  var ledger = pricing.computeTotals(items, 'SAVE10');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual({
    discount: ledger.discount,
    tax: ledger.tax,
    total: ledger.total
  }, {
    discount: 150,
    tax: 92.5,
    total: 1942.5
  });
  assert.deepEqual({
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total
  }, {
    discount: 150,
    tax: 92.5,
    cgst: 46.25,
    sgst: 46.25,
    total: 1942.5
  });
});

test('rendered invoice omits the reconciliation notice when totals match', function () {
  var html = invoice.render({
    id: 1,
    date: '01/01/2022',
    customer: 'Walk-in',
    paymentMode: 'cash',
    status: 'completed',
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: '',
    total: 105
  });

  assert.match(html, /GST Amt<\/th>/);
  assert.match(html, /5%<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
