'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');

function billedOrder(items, coupon) {
  var totals = pricing.computeTotals(items, coupon || '');
  var db = { nextOrderId: 1, orders: [] };

  return orders.add(db, {
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
}

test('invoice uses the same HSN GST slab and total as billing', function () {
  var order = billedOrder([{
    id: 1,
    sku: 'RICE-1',
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 2
  }]);

  assert.equal(order.tax, 10);
  assert.equal(order.total, 210);
  var figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures, {
    subtotal: 200,
    discount: 0,
    tax: 10,
    cgst: 5,
    sgst: 5,
    total: 210,
    rows: [{
      name: 'Rice',
      sku: 'RICE-1',
      hsn: '1006',
      qty: 2,
      price: 100,
      gstPercent: 5,
      line: 200,
      lineTax: 10
    }]
  });
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);

  var html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹10\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹210\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice uses the billed discount basis and post-discount GST', function () {
  var order = billedOrder([{
    id: 2,
    sku: 'TEA-1',
    name: 'Tea',
    hsn: '0902',
    price: 1000,
    qty: 1
  }], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    billedDiscount: order.discount,
    billedTax: order.tax,
    billedTotal: order.total,
    invoiceDiscount: figures.discount,
    invoiceTax: figures.tax,
    invoiceTotal: figures.total
  }, {
    billedDiscount: 100,
    billedTax: 162,
    billedTotal: 1062,
    invoiceDiscount: 100,
    invoiceTax: 162,
    invoiceTotal: 1062
  });

  var html = invoice.render(order);
  assert.match(html, /Coupon Discount \(SAVE10\).*?-₹100\.00/);
  assert.match(html, /₹162\.00<\/td><td class="r"><strong>₹1000\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
