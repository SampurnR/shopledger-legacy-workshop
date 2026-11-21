var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');
var store = require('../lib/store');
var orderRouter = require('../routes/orders');

// ====================================================================
// Invoice and checkout characterization
// Covers: INV-1 and INV-2; current working-tree behavior, not desired behavior
// Cases:
//   [x] mixed GST rates and a flat coupon
//   [x] capped coupon and unknown HSN fallback
//   [x] invoice recalculates rather than using stored historical figures
//   [x] tax-only mismatch is reported without an invoice notice
//   [x] independently rounded line discounts differ from the cart discount
//   [x] checkout drops a product's explicit GST rate when building order lines
// ====================================================================

test('CURRENT BEHAVIOUR: invoice and checkout apply a flat discount before mixed GST slabs', function () {
  var items = [
    { id: 1, name: 'Butter', hsn: '0405', price: 260, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 140, qty: 1 }
  ];

  var checkout = pricing.computeTotals(items, 'FLAT50');
  var result = invoice.computeInvoiceFigures({ items: items, coupon: 'FLAT50' });

  assert.deepEqual([checkout.subtotal, checkout.discount, checkout.tax, checkout.total], [400, 50, 49.35, 399.35]);
  assert.deepEqual([result.subtotal, result.discount, result.tax, result.total], [400, 50, 49.35, 399.35]);
  assert.deepEqual(result.rows.map(function (row) { return [row.gstPercent, row.line, row.lineTax]; }), [[12, 260, 27.3], [18, 140, 22.05]]);
  assert.deepEqual([result.cgst, result.sgst], [24.68, 24.67]);
});

test('CURRENT BEHAVIOUR: SAVE10 caps the discount at 150 before calculating GST', function () {
  var order = { coupon: 'SAVE10', items: [{ name: 'Oil', hsn: '1508', price: 1120, qty: 2 }] };

  var result = invoice.computeInvoiceFigures(order);

  assert.deepEqual([result.subtotal, result.discount, result.tax, result.total], [2240, 150, 104.5, 2194.5]);
  assert.deepEqual([result.rows[0].gstPercent, result.cgst, result.sgst], [5, 52.25, 52.25]);
});

test('CURRENT BEHAVIOUR: unknown HSN falls back to 18 percent GST', function () {
  var order = { items: [{ name: 'Unknown slab', hsn: '9999', price: 100, qty: 1 }] };

  var result = invoice.computeInvoiceFigures(order);

  assert.deepEqual([result.rows[0].gstPercent, result.tax, result.total], [18, 18, 118]);
});

test('CURRENT BEHAVIOUR: invoice recomputes historical totals instead of using stored billed amounts', function () {
  var order = {
    id: 42, date: '01/01/2022', coupon: 'DIWALI20',
    items: [{ name: 'Tea', hsn: '0902', price: 1000, qty: 1 }],
    subtotal: 1000, discount: 200, tax: 144, total: 944
  };

  var result = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);
  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.deepEqual([result.discount, result.tax, result.total], [0, 180, 1180]);
  assert.match(html, /Accountant Reconciliation Notice/);
  assert.match(html, /\+₹236\.00/);
  assert.equal(reconciliation.mismatchCount, 1);
  assert.equal(reconciliation.rows[0].delta, 236);
});

test('CURRENT BEHAVIOUR: a tax-only mismatch is reported but has no invoice reconciliation notice', function () {
  var order = {
    id: 43, date: '01/01/2022', items: [{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }],
    subtotal: 100, discount: 0, tax: 10, total: 118
  };

  var reconciliation = reports.getGstReconciliation({ orders: [order] });
  var html = invoice.render(order);

  assert.equal(reconciliation.mismatchCount, 1);
  assert.equal(reconciliation.rows[0].invoiceTax, 18);
  assert.equal(reconciliation.rows[0].ledgerTax, 10);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('CURRENT BEHAVIOUR: rounded line discounts can add up to more than the cart discount', function () {
  var items = [
    { name: 'A', hsn: '1006', price: 0.1, qty: 1 },
    { name: 'B', hsn: '1006', price: 0.1, qty: 1 },
    { name: 'C', hsn: '1006', price: 0.1, qty: 1 }
  ];

  var checkout = pricing.computeTotals(items, 'WELCOME');
  var result = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.equal(checkout.discount, 0.02);
  assert.deepEqual(checkout.lines.map(function (line) { return line.discount; }), [0.01, 0.01, 0.01]);
  assert.deepEqual(checkout.lines.map(function (line) { return line.net; }), [0.09, 0.09, 0.09]);
  assert.equal(result.total, 0.28);
});

test('CURRENT BEHAVIOUR: checkout drops product GST rate and uses the fallback for a missing HSN', function (t) {
  var db = {
    products: [{ id: 1, name: 'Item', price: 100, stock: 1, gstRate: 0.05 }],
    orders: [], customers: [], auditLog: [], nextOrderId: 1
  };
  var saved;
  var response = { status: function (code) { this.statusCode = code; return this; }, json: function (body) { this.body = body; return this; } };
  var route = orderRouter.stack.find(function (layer) { return layer.route && layer.route.path === '/orders' && layer.route.methods.post; });
  t.mock.method(store, 'read', function () { return db; });
  t.mock.method(store, 'write', function (data) { saved = data; });

  route.route.stack[0].handle({ body: { items: [{ id: 1, qty: 1 }] } }, response);
  var figures = invoice.computeInvoiceFigures(response.body);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.items[0].gstRate, undefined);
  assert.equal(response.body.tax, 18);
  assert.equal(response.body.total, 118);
  assert.equal(figures.rows[0].gstPercent, 18);
  assert.equal(saved, db);
});
