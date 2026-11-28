var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');

function addInMemoryOrder(items, coupon, totals) {
  var db = {
    nextOrderId: 1,
    orders: []
  };

  return orders.add(db, {
    items: items,
    coupon: coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
}

test('invoice uses the billed HSN slab on order lines', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 2
  }];
  var billed = pricing.computeTotals(items, '');
  var order = addInMemoryOrder(items, '', billed);
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed, {
    subtotal: 200,
    discount: 0,
    taxable: 200,
    tax: 10,
    cgst: 5,
    sgst: 5,
    total: 210,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 200,
      discount: 0,
      taxable: 200,
      tax: 10,
      net: 210
    }]
  });
  assert.deepEqual(figures, {
    subtotal: 200,
    discount: 0,
    tax: 10,
    cgst: 5,
    sgst: 5,
    total: 210,
    rows: [{
      name: 'Rice',
      sku: '-',
      hsn: '1006',
      qty: 2,
      price: 100,
      gstPercent: 5,
      line: 200,
      lineTax: 10
    }]
  });
});

test('invoice uses the billed capped SAVE10 discount and post-discount GST', function () {
  var items = [{
    id: 2,
    name: 'Packaged tea',
    hsn: '0902',
    price: 1000,
    qty: 2
  }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var order = addInMemoryOrder(items, 'SAVE10', billed);
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total
  }, {
    subtotal: 2000,
    discount: 150,
    tax: 333,
    cgst: 166.5,
    sgst: 166.5,
    total: 2183
  });
  assert.deepEqual(figures, {
    subtotal: 2000,
    discount: 150,
    tax: 333,
    cgst: 166.5,
    sgst: 166.5,
    total: 2183,
    rows: [{
      name: 'Packaged tea',
      sku: '-',
      hsn: '0902',
      qty: 2,
      price: 1000,
      gstPercent: 18,
      line: 2000,
      lineTax: 333
    }]
  });
});
