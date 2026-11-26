var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');
var store = require('../lib/store');
var app = require('../server');

function item(price, extra) {
  return Object.assign({ id: 1, name: 'Item', price: price, qty: 1 }, extra);
}

test('order, khata debit, invoice and reconciliation agree on GST figures', async function (t) {
  var db = {
    nextOrderId: 1,
    orders: [],
    products: [{ id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', gstRate: 12, price: 500, stock: 10 }],
    customers: [{ id: 1, name: 'Test customer', creditLimit: 5000, totalBilled: 0, totalSettled: 0 }],
    audit: []
  };
  var original = { read: store.read, write: store.write, appendAudit: store.appendAudit };
  store.read = function () { return db; };
  store.write = function (value) { assert.equal(value, db); };
  store.appendAudit = function () {};
  var server = app.listen(0);
  t.after(function () {
    server.close();
    Object.assign(store, original);
  });
  var base = 'http://127.0.0.1:' + server.address().port;
  var response = await fetch(base + '/api/orders', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: [{ id: 1, qty: 1 }], coupon: ' save10 ', paymentMode: 'khata', customerId: 1 })
  });
  assert.equal(response.status, 201);
  var order = await response.json();
  assert.deepEqual(order.items, [{ id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 500, qty: 1 }]);
  assert.deepEqual([order.coupon, order.subtotal, order.discount, order.tax, order.total], ['SAVE10', 500, 50, 22.5, 472.5]);
  assert.equal(db.customers[0].totalBilled, 472.5);
  assert.equal(db.products[0].stock, 9);
  var figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual([figures.subtotal, figures.discount, figures.tax, figures.cgst, figures.sgst, figures.total], [500, 50, 22.5, 11.25, 11.25, 472.5]);
  assert.deepEqual([figures.rows[0].hsn, figures.rows[0].gstPercent, figures.rows[0].lineTax], ['1006', 5, 22.5]);
  var html = await (await fetch(base + '/orders/' + order.id + '/invoice')).text();
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  var reconciliation = reports.getGstReconciliation(db);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.deepEqual([reconciliation.rows[0].invoiceTax, reconciliation.rows[0].delta, reconciliation.rows[0].matched], [22.5, 0, true]);
});

test('invoice GST rate follows pricing for decimal and zero rates', function () {
  var items = [item(100, { gstRate: 0.05 }), item(100, { id: 2, gstRate: 0 })];
  var billed = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({ items: items });
  assert.equal(billed.tax, 5);
  assert.deepEqual(billed.lines.map(function (line) { return line.gstPercent; }), [5, 0]);
  assert.equal(figures.tax, 5);
  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [5, 0]);
});

test('invoice follows coupon caps, minimums, activation and normalization', function () {
  var items = [item(3000)];
  assert.equal(pricing.computeTotals(items, 'SAVE10').discount, 150);
  assert.equal(invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' }).discount, 150);
  assert.equal(pricing.computeTotals([item(100)], 'FLAT50').discount, 0);
  assert.equal(invoice.computeInvoiceFigures({ items: [item(100)], coupon: 'FLAT50' }).discount, 0);
  assert.equal(pricing.computeTotals(items, 'DIWALI20').discount, 0);
  assert.equal(invoice.computeInvoiceFigures({ items: items, coupon: 'DIWALI20' }).discount, 0);
  assert.equal(pricing.computeTotals(items, ' save10 ').discount, 150);
  assert.equal(invoice.computeInvoiceFigures({ items: items, coupon: ' save10 ' }).discount, 150);
});

test('invoice uses pricing line tax rounding', function () {
  var items = [item(0.03), item(0.03, { id: 2 })];
  var billed = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({ items: items });
  assert.equal(billed.tax, 0.02);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [0.02, 0.01, 0.01, 0.08]);
});

test('CURRENT BEHAVIOUR: reconciliation can flag tax differences without a total notice', function () {
  var order = { id: 1, items: [item(100, { hsn: '1006' })], subtotal: 100, discount: 0, tax: 18, total: 105 };
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  var result = reports.getGstReconciliation({ orders: [order, Object.assign({}, order, { status: 'cancelled' })] });
  assert.deepEqual([result.totalChecked, result.mismatchCount, result.totalDelta, result.rows[0].matched], [1, 1, 0, false]);
});
