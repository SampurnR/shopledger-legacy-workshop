var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function createInMemoryDb() {
  return {
    nextOrderId: 1001,
    orders: [],
    products: [],
    customers: []
  };
}

function checkoutOrder(db) {
  var items = [
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, name: 'Ghee', sku: 'GHEE-1', hsn: '0405', price: 500, qty: 1 }
  ];
  var totals = pricing.computeTotals(items, 'SAVE10');

  return orders.add(db, {
    date: '2026-11-21',
    customer: 'Characterization Customer',
    items: items,
    coupon: 'SAVE10',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
}

test('checkout totals use HSN slabs and apply SAVE10 before GST', function () {
  var totals = pricing.computeTotals([
    { id: 1, hsn: '1006', price: 1000, qty: 1 },
    { id: 2, hsn: '0405', price: 500, qty: 1 }
  ], 'SAVE10');

  assert.deepEqual(totals, {
    subtotal: 1500,
    discount: 150,
    taxable: 1350,
    tax: 99,
    cgst: 49.5,
    sgst: 49.5,
    total: 1449,
    lines: [
      { id: 1, name: undefined, hsn: '1006', gstPercent: 5, gross: 1000, discount: 100, taxable: 900, tax: 45, net: 945 },
      { id: 2, name: undefined, hsn: '0405', gstPercent: 12, gross: 500, discount: 50, taxable: 450, tax: 54, net: 504 }
    ]
  });
});

test('invoice figures match the GST and total billed at checkout', function () {
  var db = createInMemoryDb();
  var order = checkoutOrder(db);

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 1500,
    discount: 150,
    tax: 99,
    cgst: 49.5,
    sgst: 49.5,
    total: 1449,
    rows: [
      { name: 'Rice', sku: 'RICE-1', hsn: '1006', qty: 1, price: 1000, gstPercent: 5, line: 1000, lineTax: 45 },
      { name: 'Ghee', sku: 'GHEE-1', hsn: '0405', qty: 1, price: 500, gstPercent: 12, line: 500, lineTax: 54 }
    ]
  });
});

test('invoice uses HSN slabs when line items do not carry gstRate', function () {
  var db = createInMemoryDb();
  var order = checkoutOrder(db);
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures, {
    subtotal: 1500,
    discount: 150,
    tax: 99,
    cgst: 49.5,
    sgst: 49.5,
    total: 1449,
    rows: [
      { name: 'Rice', sku: 'RICE-1', hsn: '1006', qty: 1, price: 1000, gstPercent: 5, line: 1000, lineTax: 45 },
      { name: 'Ghee', sku: 'GHEE-1', hsn: '0405', qty: 1, price: 500, gstPercent: 12, line: 500, lineTax: 54 }
    ]
  });
  assert.equal(order.total, 1449);
});

test('invoice applies SAVE10 before GST with the checkout discount cap', function () {
  var db = createInMemoryDb();
  var order = checkoutOrder(db);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 150);
  assert.equal(figures.discount, 150);
  assert.equal(figures.total, order.total);
});

test('invoice keeps billed figures for an order with an expired coupon', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }],
    coupon: 'DIWALI20',
    subtotal: 1000,
    discount: 200,
    tax: 40,
    total: 840
  });

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total
  }, {
    subtotal: 1000,
    discount: 200,
    tax: 40,
    cgst: 20,
    sgst: 20,
    total: 840
  });
  assert.equal(figures.rows[0].lineTax, 40);
});

test('reconciliation and rendered invoice report matching figures', function () {
  var db = createInMemoryDb();
  var order = checkoutOrder(db);
  var reconciliation = reports.getGstReconciliation(db);
  var html = invoice.render(order);

  assert.deepEqual(reconciliation, {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 1001,
      date: '2026-11-21',
      customer: 'Characterization Customer',
      coupon: 'SAVE10',
      ledgerSubtotal: 1500,
      ledgerDiscount: 150,
      ledgerTax: 99,
      ledgerTotal: 1449,
      invoiceDiscount: 150,
      invoiceTax: 99,
      invoiceTotal: 1449,
      delta: 0,
      matched: true
    }]
  });
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
