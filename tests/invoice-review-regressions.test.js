const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const reports = require('../lib/reports');
const store = require('../lib/store');
const orderRouter = require('../routes/orders');
const config = require('../config');

function orderWith(items, tax, total) {
  return { id: 1, date: '01/01/2022', customer: 'Walk-in', paymentMode: 'cash',
    status: 'completed', coupon: '', items, subtotal: 100, discount: 0, tax, total };
}

test('reconciliation detects a saved total that disagrees with order arithmetic', () => {
  const order = orderWith([{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }], 5, 106);
  const result = reports.getGstReconciliation({ orders: [order] });
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.rows[0].matched, false);
  assert.equal(result.rows[0].delta, -1);
});

test('reconciliation detects saved GST that disagrees with recorded line GST', () => {
  const order = orderWith([
    { id: 1, name: 'Rice', hsn: '1006', gstRate: 0.05, lineTax: 5, price: 100, qty: 1 }
  ], 6, 106);
  const result = reports.getGstReconciliation({ orders: [order] });
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.rows[0].matched, false);
  assert.equal(result.rows[0].taxVerified, true);
});

test('subtotal mismatch is visible in the audit and printable invoice', () => {
  const order = orderWith([{ id: 1, name: 'Rice', price: 100, qty: 1 }], 5, 105);
  order.subtotal = 101;
  const result = reports.getGstReconciliation({ orders: [order] });
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalSubtotalDelta, 1);
  assert.match(invoice.render(order), /Item subtotal check/);
});

test('legacy orders without saved line GST do not display a guessed rate or amount', () => {
  const order = orderWith([{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }], 5, 105);
  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.rows[0].gstPercent, null);
  assert.equal(figures.rows[0].lineTax, null);
  assert.match(invoice.render(order), /GST rate and line tax were not recorded/);
});

test('new orders save the rate and discounted GST charged on each line', () => {
  const db = { products: [{ id: 1, sku: 'RICE', name: 'Rice', hsn: '1006',
    price: 1000, stock: 10, reserved: 0 }], customers: [], orders: [],
  settlements: [], auditLog: [], nextOrderId: 1, nextSettlementId: 1 };
  const read = store.read;
  const write = store.write;
  store.read = () => db;
  store.write = () => {};
  try {
    const handler = orderRouter.stack.find(layer => layer.route &&
      layer.route.path === '/orders' && layer.route.methods.post).route.stack[0].handle;
    let status;
    let created;
    const response = {
      status(code) { status = code; return this; },
      json(body) { created = body; return this; }
    };
    handler({ body: { items: [{ id: 1, qty: 1 }], coupon: 'SAVE10' } }, response);
    assert.equal(status, 201);
    assert.equal(created.discount, 100);
    assert.equal(created.items[0].gstRate, 0.05);
    assert.equal(created.items[0].lineTax, 45);
  } finally {
    store.read = read;
    store.write = write;
  }
});

test('reconciliation uses checkout subtotal rounding for fractional prices', () => {
  const order = { id: 2, date: '01/01/2022', customer: 'Walk-in', status: 'completed',
    coupon: '', items: [
      { id: 1, name: 'A', price: 0.335, qty: 1 },
      { id: 2, name: 'B', price: 0.335, qty: 1 }
    ], subtotal: 0.67, discount: 0, tax: 0, total: 0.67 };
  const result = reports.getGstReconciliation({ orders: [order] });
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].matched, true);
});

test('saved line rate and GST remain stable when the configured HSN slab changes', () => {
  const order = orderWith([
    { id: 1, name: 'Rice', hsn: '1006', gstRate: 0.05, lineTax: 5, price: 100, qty: 1 }
  ], 5, 105);
  const previous = config.tax.hsnSlabs['1006'];
  try {
    config.tax.hsnSlabs['1006'] = 12;
    const figures = invoice.computeInvoiceFigures(order);
    assert.equal(figures.rows[0].gstPercent, 5);
    assert.equal(figures.rows[0].lineTax, 5);
    assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 0);
  } finally {
    config.tax.hsnSlabs['1006'] = previous;
  }
});
