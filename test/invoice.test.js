'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var store = require('../lib/store');
var orderRouter = require('../routes/orders');

test('placed order invoice matches billed HSN-based GST and total', function () {
  var db = {
    nextOrderId: 1001,
    nextSettlementId: 501,
    products: [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, stock: 10 }],
    customers: [],
    orders: [],
    settlements: [],
    auditLog: []
  };
  var originalRead = store.read;
  var originalWrite = store.write;

  var response = { status: 200, body: null };
  var res = {
    status: function (code) { response.status = code; return this; },
    json: function (body) { response.body = body; return this; }
  };
  var route = orderRouter.stack.filter(function (layer) {
    return layer.route && layer.route.path === '/orders' && layer.route.methods.post;
  })[0];

  store.read = function () { return db; };
  store.write = function () {};
  try {
    route.route.stack[0].handle({
      body: { items: [{ id: 1, qty: 1 }], paymentMode: 'cash' },
      query: {},
      params: {}
    }, res);
  } finally {
    store.read = originalRead;
    store.write = originalWrite;
  }

  assert.equal(response.status, 201);
  assert.deepEqual(
    { subtotal: response.body.subtotal, tax: response.body.tax, total: response.body.total },
    { subtotal: 100, tax: 5, total: 105 }
  );
  assert.equal(db.products[0].stock, 9);

  var invoiceFigures = invoice.computeInvoiceFigures(response.body);
  assert.deepEqual(
    { gstPercent: invoiceFigures.rows[0].gstPercent, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { gstPercent: 5, tax: 5, total: 105 }
  );
  assert.deepEqual({ cgst: invoiceFigures.cgst, sgst: invoiceFigures.sgst }, { cgst: 2.5, sgst: 2.5 });
  var invoiceHtml = invoice.render(response.body);
  assert.match(invoiceHtml, /5%/);
  assert.doesNotMatch(invoiceHtml, /Accountant Reconciliation Notice/);
});

test('invoice applies coupon discount before HSN-based GST, matching the billed totals', function () {
  var items = [{ id: 2, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual(
    { discount: billed.discount, tax: billed.tax, total: billed.total },
    { discount: 100, tax: 45, total: 945 }
  );
  assert.deepEqual(
    { discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { discount: 100, tax: 45, total: 945 }
  );
});

test('invoice applies the configured coupon maxDiscount cap and matches the billed totals', function () {
  var items = [{ id: 3, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual(
    { discount: billed.discount, tax: billed.tax, total: billed.total },
    { discount: 150, tax: 92.5, total: 1942.5 }
  );
  assert.deepEqual(
    { discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { discount: 150, tax: 92.5, total: 1942.5 }
  );
});

test('invoice line rows show HSN GST on post-discount taxable amounts', function () {
  var items = [
    { id: 4, name: 'Rice', hsn: '1006', price: 1000, qty: 1 },
    { id: 5, name: 'Dal', hsn: '0713', price: 1000, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual(billed.lines.map(function (line) { return line.taxable; }), [925, 925]);
  assert.deepEqual(invoiceFigures.rows.map(function (row) { return row.line; }), [1000, 1000]);
  assert.deepEqual(invoiceFigures.rows.map(function (row) { return row.gstPercent; }), [5, 5]);
  assert.deepEqual(invoiceFigures.rows.map(function (row) { return row.lineTax; }), [46.25, 46.25]);
});

test('invoice figures mirror the GST, discount, and total charged on the order', function () {
  var items = [{ id: 6, name: 'Rice', sku: 'RICE-6', hsn: '1006', price: 2000, qty: 1 }];
  var charged = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({
    items: items,
    coupon: 'SAVE10',
    subtotal: charged.subtotal,
    discount: charged.discount,
    tax: charged.tax,
    total: charged.total
  });

  assert.deepEqual(
    {
      gstPercent: invoiceFigures.rows[0].gstPercent,
      discount: invoiceFigures.discount,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total
    },
    {
      gstPercent: 5,
      discount: charged.discount,
      tax: charged.tax,
      cgst: charged.cgst,
      sgst: charged.sgst,
      total: charged.total
    }
  );
});
