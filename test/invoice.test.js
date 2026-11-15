'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function makeOrder(items, coupon, details) {
  details = details || {};
  var billed = pricing.computeTotals(items, coupon);
  var db = { nextOrderId: details.id || 1, orders: [] };

  return orders.add(db, {
    date: details.date || '2026-11-15',
    customer: details.customer || 'Anika',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });
}

test('Order #1002 invoice matches checkout HSN and SAVE10 calculations', function () {
  // This reproduces the persisted route shape, where line items have HSN but no gstRate.
  var order = makeOrder([{
    id: 1,
    sku: 'GRN-001',
    name: 'Indrayani Basmati Rice 5kg',
    hsn: '1006',
    price: 640,
    qty: 1
  }, {
    id: 2,
    sku: 'OIL-001',
    name: 'Cold-Pressed Sunflower Oil 1L',
    hsn: '1512',
    price: 190,
    qty: 2
  }], 'SAVE10', {
    id: 1002,
    date: '05/01/2022',
    customer: 'Anil Kulkarni'
  });

  assert.equal(order.subtotal, 1020);
  assert.equal(order.discount, 102);
  assert.equal(order.tax, 45.9);
  assert.equal(order.total, 963.9);

  var figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures, {
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9,
    rows: [{
      name: 'Indrayani Basmati Rice 5kg',
      sku: 'GRN-001',
      hsn: '1006',
      qty: 1,
      price: 640,
      gstPercent: 5,
      line: 640,
      lineTax: 28.8
    }, {
      name: 'Cold-Pressed Sunflower Oil 1L',
      sku: 'OIL-001',
      hsn: '1512',
      qty: 2,
      price: 190,
      gstPercent: 5,
      line: 380,
      lineTax: 17.1
    }]
  });

  var reconciliation = reports.getGstReconciliation({ orders: [order] });
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.deepEqual(reconciliation.rows[0], {
    orderId: 1002,
    date: '05/01/2022',
    customer: 'Anil Kulkarni',
    coupon: 'SAVE10',
    ledgerSubtotal: 1020,
    ledgerDiscount: 102,
    ledgerTax: 45.9,
    ledgerTotal: 963.9,
    invoiceDiscount: 102,
    invoiceTax: 45.9,
    invoiceTotal: 963.9,
    delta: 0,
    matched: true
  });

  var html = invoice.render(order);
  assert.match(html, /<td>CGST \+ SGST \(Total GST\)<\/td><td class="r">₹45\.90/);
  assert.match(html, /<td>Coupon Discount \(SAVE10\)<\/td><td class="r" style="color:#16a34a">-₹102\.00/);
  assert.match(html, /<td>Invoice Total<\/td><td class="r">₹963\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('Order #1004 invoice applies the SAVE10 maximum discount and 5% HSN slab', function () {
  var order = makeOrder([{
    id: 9,
    sku: 'OIL-1',
    name: 'Groundnut Oil',
    hsn: '1508',
    price: 2240,
    qty: 1
  }], 'SAVE10', {
    id: 1004,
    date: '30/01/2022',
    customer: 'Kalyani Foods'
  });

  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.subtotal, 2240);
  assert.equal(order.discount, 150);
  assert.equal(order.tax, 104.5);
  assert.equal(order.total, 2194.5);
  assert.equal(figures.tax, 104.5);
  assert.equal(figures.discount, 150);
  assert.equal(figures.total, 2194.5);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 104.5);

  var reconciliation = reports.getGstReconciliation({ orders: [order] });
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});

test('Invoice uses the HSN slab for no-coupon 5% and 12% items', function () {
  var order5 = makeOrder([{
    id: 10,
    sku: 'RICE-2',
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 1
  }], '', { id: 1001 });
  var order12 = makeOrder([{
    id: 11,
    sku: 'GHEE-1',
    name: 'Ghee',
    hsn: '0405',
    price: 100,
    qty: 1
  }], '', { id: 1007 });

  var invoice5 = invoice.computeInvoiceFigures(order5);
  var invoice12 = invoice.computeInvoiceFigures(order12);

  assert.equal(order5.tax, 5);
  assert.equal(order5.total, 105);
  assert.equal(invoice5.rows[0].gstPercent, 5);
  assert.equal(invoice5.tax, 5);
  assert.equal(invoice5.total, 105);

  assert.equal(order12.tax, 12);
  assert.equal(order12.total, 112);
  assert.equal(invoice12.rows[0].gstPercent, 12);
  assert.equal(invoice12.tax, 12);
  assert.equal(invoice12.total, 112);
});

test('All-18% order without a coupon matches the invoice', function () {
  var order = makeOrder([{
    id: 12,
    sku: 'TEA-1',
    name: 'Packaged Tea',
    hsn: '0902',
    price: 100,
    qty: 1
  }], '', { id: 1008 });

  var figures = invoice.computeInvoiceFigures(order);
  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(order.tax, 18);
  assert.equal(order.discount, 0);
  assert.equal(order.total, 118);
  assert.equal(figures.tax, 18);
  assert.equal(figures.discount, 0);
  assert.equal(figures.total, 118);
  assert.equal(reconciliation.rows[0].matched, true);
});
