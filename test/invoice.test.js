var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice resolves the HSN slab and matches checkout GST', function () {
  var items = [
    { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 100, qty: 1 }
  ];
  var order = { items: items, coupon: '' };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 100,
    discount: 0,
    tax: 5,
    cgst: 2.5,
    sgst: 2.5,
    total: 105,
    rows: [
      {
        name: 'Rice',
        sku: 'GRN-001',
        hsn: '1006',
        qty: 1,
        price: 100,
        gstPercent: 5,
        line: 100,
        lineTax: 5
      }
    ]
  });

  assert.equal(pricing.computeTotals(items, '').tax, 5);
});

test('invoice matches checkout totals for the HSN and capped SAVE10 order', function () {
  var items = [
    { id: 5, name: 'Groundnut Oil', sku: 'OIL-002', hsn: '1508', price: 1120, qty: 2 }
  ];
  var order = { items: items, coupon: 'SAVE10' };

  var invoiceFigures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(invoiceFigures, {
    subtotal: 2240,
    discount: 150,
    tax: 104.5,
    cgst: 52.25,
    sgst: 52.25,
    total: 2194.5,
    rows: [
      {
        name: 'Groundnut Oil',
        sku: 'OIL-002',
        hsn: '1508',
        qty: 2,
        price: 1120,
        gstPercent: 5,
        line: 2240,
        lineTax: 104.5
      }
    ]
  });

  var checkoutFigures = pricing.computeTotals(items, 'SAVE10');
  assert.equal(checkoutFigures.discount, 150);
  assert.equal(checkoutFigures.tax, 104.5);
  assert.equal(checkoutFigures.total, 2194.5);
  assert.equal(invoiceFigures.total, checkoutFigures.total);
});

test('invoice ignores an inactive coupon', function () {
  var order = {
    items: [
      { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', gstRate: 5, price: 1000, qty: 1 }
    ],
    coupon: 'DIWALI20'
  };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 1000,
    discount: 0,
    tax: 50,
    cgst: 25,
    sgst: 25,
    total: 1050,
    rows: [
      {
        name: 'Rice',
        sku: 'GRN-001',
        hsn: '1006',
        qty: 1,
        price: 1000,
        gstPercent: 5,
        line: 1000,
        lineTax: 50
      }
    ]
  });
});

test('rendered invoice omits the mismatch warning when its total matches the ledger', function () {
  var order = {
    id: 1004,
    date: '30/01/2022',
    status: 'completed',
    customer: 'Kalyani Foods',
    paymentMode: 'khata',
    coupon: 'SAVE10',
    total: 2194.5,
    items: [
      { id: 5, name: 'Groundnut Oil', sku: 'OIL-002', hsn: '1508', price: 1120, qty: 2 }
    ]
  };

  var html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2194\.50<\/td>/);
  assert.doesNotMatch(html, /class="warn-box"/);
});
