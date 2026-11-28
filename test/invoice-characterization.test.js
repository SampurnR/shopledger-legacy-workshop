var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice uses HSN GST when line has no gstRate', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 1
  }];
  var billed = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(billed, {
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

test('invoice matches billed SAVE10 discount and GST', function () {
  var items = [{
    id: 2,
    name: 'Tea',
    hsn: '0902',
    price: 3000,
    qty: 1
  }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 513);
  assert.equal(billed.total, 3363);

  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 513);
  assert.equal(figures.cgst, 256.5);
  assert.equal(figures.sgst, 256.5);
  assert.equal(figures.total, 3363);
});

test('rendered invoice shows billed total without a reconciliation warning', function () {
  var order = {
    id: 501,
    date: '01/01/2022',
    customer: 'Walk-in',
    paymentMode: 'cash',
    coupon: '',
    total: 105,
    items: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      price: 100,
      qty: 1
    }]
  };
  var html = invoice.render(order);

  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
