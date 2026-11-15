var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var vm = require('node:vm');
var invoice = require('../lib/invoice');

// Execute unchanged route source with a closed dependency map. The real store
// is never imported, even temporarily. Only these two source files are read;
// all business data and persistence calls remain in memory. No HTTP listener
// or dependency installation is needed to invoke the registered handlers.
var dependencies = {
  '../config': require('../config'),
  '../lib/inventory': require('../lib/inventory'),
  '../lib/pricing': require('../lib/pricing'),
  '../lib/coupons': require('../lib/coupons'),
  '../lib/orders': require('../lib/orders'),
  '../lib/ledger': require('../lib/ledger'),
  '../lib/reports': require('../lib/reports')
};

function harness(db) {
  var calls = { reads: 0, writes: 0, audit: [] };
  var handlers = {};
  var store = {
    read: function () { calls.reads++; return db; },
    write: function (value) { assert.equal(value, db); calls.writes++; },
    appendAudit: function (value, action, details) {
      assert.equal(value, db);
      calls.audit.push({ action: action, details: details });
    }
  };
  ['orders', 'reports'].forEach(function (name) {
    var router = {
      get: function (url, handler) { handlers['GET ' + url] = handler; },
      post: function (url, handler) { handlers['POST ' + url] = handler; }
    };
    var filename = path.join(__dirname, '..', 'routes', name + '.js');
    var source = fs.readFileSync(filename, 'utf8');
    var module = { exports: {} };
    vm.compileFunction(source, ['require', 'module', 'exports'], { filename: filename })(function (id) {
      if (id === 'express') return { Router: function () { return router; } };
      if (id === '../lib/store') return store;
      if (Object.hasOwn(dependencies, id)) return dependencies[id];
      throw new Error('Unapproved route dependency: ' + id);
    }, module, module.exports);
  });
  return {
    calls: calls,
    post: function (url, body) {
      var result = { status: 200 };
      var response = {
        status: function (code) { result.status = code; return response; },
        json: function (value) { result.body = value; return response; }
      };
      assert.equal(typeof handlers['POST ' + url], 'function');
      handlers['POST ' + url]({ body: body }, response);
      return result;
    }
  };
}

function fixture() {
  return {
    nextOrderId: 1001, orders: [],
    products: [{ id: 1, sku: 'FIX-1', name: 'Fixture rice', hsn: '1006', price: 500, stock: 100 }],
    customers: [{ id: 7, name: 'Fixture customer', creditLimit: 5000, openingBalance: 10, totalBilled: 0, totalSettled: 0 }]
  };
}

test('REGRESSION: invoice agrees with the actual khata debit after GST calculation', function () {
  var db = fixture();
  var app = harness(db);
  var result = app.post('/orders', {
    items: [{ id: 1, qty: 1 }], coupon: 'SAVE10', paymentMode: 'khata', customerId: 7
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.total, 472.5);
  assert.equal(db.customers[0].totalBilled, 472.5);
  assert.equal(db.customers[0].balance, 482.5);
  var printed = invoice.computeInvoiceFigures(result.body);
  assert.equal(printed.total, 472.5);
  assert.deepEqual([printed.discount, printed.tax, printed.cgst, printed.sgst], [50, 22.5, 11.25, 11.25]);
});

['cash', 'upi', 'khata'].forEach(function (mode) {
  test('CURRENT BEHAVIOUR: ' + mode + ' records ledger and invoice total 472.50', function () {
    var db = fixture();
    var app = harness(db);
    var body = { items: [{ id: 1, qty: 1, price: 1 }], coupon: ' save10 ', paymentMode: mode, customerId: 7, total: 1, shipping: 100, additionalCharges: 50 };
    var preview = app.post('/pricing/preview', body);
    assert.equal(preview.status, 200);
    assert.deepEqual([preview.body.totals.subtotal, preview.body.totals.discount, preview.body.totals.tax, preview.body.totals.total], [500, 50, 22.5, 472.5]);
    assert.equal(preview.body.couponStatus.valid, true);
    assert.equal(app.calls.writes, 0);
    var result = app.post('/orders', body);
    assert.equal(result.status, 201);
    var order = result.body;
    assert.deepEqual([order.subtotal, order.discount, order.tax, order.total], [500, 50, 22.5, 472.5]);
    assert.deepEqual(order.items, [{ id: 1, sku: 'FIX-1', name: 'Fixture rice', hsn: '1006', price: 500, qty: 1 }]);
    assert.equal(order.paymentMode, mode);
    assert.equal(order.coupon, 'SAVE10');
    assert.equal(order.customer, 'Fixture customer');
    assert.equal(db.orders[0], order);
    assert.equal(db.products[0].stock, 99);
    assert.equal(app.calls.reads, 2);
    assert.equal(app.calls.writes, 1);
    assert.deepEqual(app.calls.audit, [{ action: 'ORDER_CREATED', details: 'Order #1001 (Fixture customer) ₹472.50' }]);
    assert.equal(db.customers[0].totalBilled, mode === 'khata' ? 472.5 : 0);
    if (mode === 'khata') assert.equal(db.customers[0].balance, 482.5);
    var printed = invoice.computeInvoiceFigures(order);
    assert.deepEqual([printed.subtotal, printed.discount, printed.tax, printed.total], [500, 50, 22.5, 472.5]);
    assert.ok(!invoice.render(order).includes('Accountant Reconciliation Notice:'));
  });
});

test('CURRENT BEHAVIOUR: product explicit GST override is omitted from preview and persisted order lines', function () {
  var db = fixture();
  db.products[0].gstRate = 0;
  var app = harness(db);
  var body = { items: [{ id: 1, qty: 1 }] };
  assert.equal(app.post('/pricing/preview', body).body.totals.tax, 25);
  var result = app.post('/orders', body);
  assert.equal(result.status, 201);
  assert.deepEqual([result.body.tax, result.body.total], [25, 525]);
  assert.equal(Object.hasOwn(result.body.items[0], 'gstRate'), false);
  assert.equal(invoice.computeInvoiceFigures(result.body).total, 525);
});

test('CURRENT BEHAVIOUR: preview accepts fractional quantity while order creation truncates it', function () {
  var app = harness(fixture());
  var body = { items: [{ id: 1, qty: 1.5 }] };
  assert.equal(app.post('/pricing/preview', body).body.totals.total, 787.5);
  var result = app.post('/orders', body);
  assert.equal(result.status, 201);
  assert.equal(result.body.items[0].qty, 1);
  assert.equal(result.body.total, 525);
});

test('CURRENT BEHAVIOUR: invalid coupon preview omits discount but order creation rejects billing', function () {
  var db = fixture();
  var app = harness(db);
  var body = { items: [{ id: 1, qty: 1 }], coupon: 'DIWALI20' };
  var preview = app.post('/pricing/preview', body);
  assert.deepEqual(preview.body.couponStatus, { valid: false, error: 'Coupon DIWALI20 has expired' });
  assert.deepEqual([preview.body.totals.discount, preview.body.totals.total], [0, 525]);
  assert.deepEqual(app.post('/orders', body), { status: 400, body: { error: 'Coupon DIWALI20 has expired' } });
  assert.equal(app.calls.writes, 0);
  assert.deepEqual(db.orders, []);
  assert.equal(db.products[0].stock, 100);
});

test('CURRENT BEHAVIOUR: khata credit check uses the same amount as the invoice', function () {
  var db = fixture();
  db.customers[0].creditLimit = 500;
  var app = harness(db);
  var result = app.post('/orders', { items: [{ id: 1, qty: 1 }], coupon: 'SAVE10', customerId: 7, paymentMode: 'khata' });
  assert.equal(result.status, 201);
  assert.equal(db.customers[0].balance, 482.5);
  assert.equal(invoice.computeInvoiceFigures(result.body).total, 472.5);
});

test('CURRENT BEHAVIOUR: exceeding khata limit rejects order before persistence or billing mutation', function () {
  var db = fixture();
  db.customers[0].creditLimit = 482;
  var app = harness(db);
  var result = app.post('/orders', { items: [{ id: 1, qty: 1 }], coupon: 'SAVE10', customerId: 7, paymentMode: 'khata' });
  assert.deepEqual(result, { status: 409, body: { error: 'Khata credit limit exceeded for Fixture customer (Limit: ₹482, Projected: ₹482.50)' } });
  assert.equal(db.customers[0].totalBilled, 0);
  assert.equal(db.products[0].stock, 100);
  assert.deepEqual(db.orders, []);
  assert.equal(app.calls.writes, 0);
  assert.deepEqual(app.calls.audit, []);
});
