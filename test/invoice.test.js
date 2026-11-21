var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice matches checkout GST for a product with a reduced HSN slab', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    sku: 'GRA-001',
    hsn: '1006',
    price: 100,
    qty: 1
  }];

  var invoiceFigures = invoice.computeInvoiceFigures({ coupon: '', discount: 0, items: items });
  var checkoutFigures = pricing.computeTotals(items, '');

  assert.deepEqual({
    gstPercent: invoiceFigures.rows[0].gstPercent,
    lineTax: invoiceFigures.rows[0].lineTax,
    tax: invoiceFigures.tax,
    total: invoiceFigures.total
  }, {
    gstPercent: checkoutFigures.lines[0].gstPercent,
    lineTax: checkoutFigures.lines[0].tax,
    tax: checkoutFigures.tax,
    total: checkoutFigures.total
  });
});

test('invoice matches checkout totals and the SAVE10 discount cap', function () {
  var items = [{
    id: 2,
    name: 'Tea',
    sku: 'BEV-001',
    hsn: '0902',
    price: 2240,
    qty: 1
  }];

  var invoiceFigures = invoice.computeInvoiceFigures({ coupon: 'SAVE10', discount: 150, items: items });
  var checkoutFigures = pricing.computeTotals(items, 'SAVE10');

  assert.deepEqual({
    subtotal: invoiceFigures.subtotal,
    discount: invoiceFigures.discount,
    tax: invoiceFigures.tax,
    cgst: invoiceFigures.cgst,
    sgst: invoiceFigures.sgst,
    total: invoiceFigures.total
  }, {
    subtotal: checkoutFigures.subtotal,
    discount: checkoutFigures.discount,
    tax: checkoutFigures.tax,
    cgst: checkoutFigures.cgst,
    sgst: checkoutFigures.sgst,
    total: checkoutFigures.total
  });
});

test('invoice preserves a stored discount for a coupon that is now inactive', function () {
  var items = [{
    id: 3,
    name: 'Coffee',
    sku: 'BEV-002',
    hsn: '0901',
    price: 2000,
    qty: 1
  }];

  var invoiceFigures = invoice.computeInvoiceFigures({
    coupon: 'DIWALI20',
    discount: 250,
    items: items
  });

  assert.equal(invoiceFigures.discount, 250);
  assert.equal(invoiceFigures.tax, 315);
  assert.equal(invoiceFigures.total, 2065);
});
