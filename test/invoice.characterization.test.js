var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice uses the HSN GST slab and pre-tax coupon discount used for the billed order', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 1000,
    qty: 1
  }];

  var figures = invoice.computeInvoiceFigures({
    items: items,
    coupon: 'SAVE10'
  });

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 45);
  assert.equal(figures.subtotal, 1000);
  assert.equal(figures.discount, 100);
  assert.equal(figures.tax, 45);
  assert.equal(figures.cgst, 22.5);
  assert.equal(figures.sgst, 22.5);
  assert.equal(figures.total, 945);
});

test('invoice uses the HSN GST slab when an HSN-only line has no gstRate', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{
      name: 'Rice',
      hsn: '1006',
      price: 100,
      qty: 1
    }]
  });

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.cgst, 2.5);
  assert.equal(figures.sgst, 2.5);
  assert.equal(figures.total, 105);
});

test('invoice applies SAVE10 before GST and matches the billed-order calculation', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 1000,
    qty: 1
  }];

  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({
    items: items,
    coupon: 'SAVE10'
  });

  assert.deepEqual(billed, {
    subtotal: 1000,
    discount: 100,
    taxable: 900,
    tax: 45,
    cgst: 22.5,
    sgst: 22.5,
    total: 945,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 1000,
      discount: 100,
      taxable: 900,
      tax: 45,
      net: 945
    }]
  });
  assert.equal(invoiceFigures.tax, 45);
  assert.equal(invoiceFigures.discount, 100);
  assert.equal(invoiceFigures.total, 945);
  assert.equal(invoiceFigures.total, billed.total);
});
