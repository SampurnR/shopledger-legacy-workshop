'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');
const config = require('../config');
const store = require('../lib/store');
const orderRouter = require('../routes/orders');

// No server or filesystem-backed store is used. Route tests replace both store
// operations before dispatch, and node:test restores them after each test.
function item(overrides = {}) {
  return { id: 1, name: 'Test item', sku: 'TEST', price: 100, qty: 1, ...overrides };
}

function billedOrder(items, coupon = '') {
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  return { id: 1001, date: '21/11/2026', customer: 'Test customer',
    items, coupon, subtotal, discount, tax, total };
}

function amounts(result) {
  return [result.subtotal, result.discount, result.tax, result.cgst, result.sgst, result.total];
}

test('unmapped items without coupons agree at the default GST rate', () => {
  const items = [item({ qty: 2 })];
  const order = billedOrder(items);
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(amounts(pricing.computeTotals(items, '')), [200, 0, 36, 18, 18, 236]);
  assert.deepEqual(amounts(figures), [200, 0, 36, 18, 18, 236]);
  assert.deepEqual(figures.rows, [{ name: 'Test item', sku: 'TEST', hsn: '-',
    qty: 2, price: 100, gstPercent: 18, line: 200, lineTax: 36 }]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice:/);
});

test('invoice and billing agree on mixed HSN slabs of 5%, 12%, 18%', () => {
  const items = ['1006', '0405', '0902'].map((hsn, i) => item({ id: i + 1, hsn }));
  const billed = pricing.computeTotals(items, '');
  const figures = invoice.computeInvoiceFigures(billedOrder(items));
  assert.deepEqual(amounts(billed), [300, 0, 35, 17.5, 17.5, 335]);
  assert.deepEqual(billed.lines.map(l => [l.gstPercent, l.tax]), [[5, 5], [12, 12], [18, 18]]);
  assert.deepEqual(amounts(figures), [300, 0, 35, 17.5, 17.5, 335]);
  assert.deepEqual(figures.rows.map(r => [r.gstPercent, r.lineTax]), [[5, 5], [12, 12], [18, 18]]);
});

for (const [label, gstRate, billedTax, invoiceTax, invoicePercent] of [
  ['whole percentage', 5, 5, 5, 5],
  ['decimal rate', 0.05, 5, 5, 5],
  ['explicit zero', 0, 0, 0, 0],
  ['string rate uses default', '5', 18, 18, 18]
]) {
  test('invoice follows billing GST rate representation — ' + label, () => {
    const items = [item({ gstRate })];
    assert.equal(pricing.computeTotals(items, '').tax, billedTax);
    const figures = invoice.computeInvoiceFigures({ items });
    assert.equal(figures.tax, invoiceTax);
    assert.equal(figures.rows[0].gstPercent, invoicePercent);
    assert.equal(figures.total, 100 + invoiceTax);
  });
}

// Literal expectations pin the billing contract, rather than deriving the oracle
// from the pricing function that the invoice now shares.
for (const [label, price, coupon, expected] of [
  ['percentage discount before GST', 500, 'SAVE10', [500, 50, 81, 40.5, 40.5, 531]],
  ['flat discount before GST', 500, 'FLAT50', [500, 50, 81, 40.5, 40.5, 531]],
  ['percentage discount cap', 2000, 'SAVE10', [2000, 150, 333, 166.5, 166.5, 2183]],
  ['minimum spend', 100, 'SAVE10', [100, 0, 18, 9, 9, 118]],
  ['expired coupon ignored', 1000, 'DIWALI20', [1000, 0, 180, 90, 90, 1180]],
  ['legacy coupon text normalized', 500, ' save10 ', [500, 50, 81, 40.5, 40.5, 531]],
  ['flat discount below minimum spend ignored', 20, 'FLAT50', [20, 0, 3.6, 1.8, 1.8, 23.6]],
  ['unknown coupon ignored', 100, 'UNKNOWN', [100, 0, 18, 9, 9, 118]]
]) {
  test('invoice and billing agree on ' + label, () => {
    const items = [item({ price })];
    assert.deepEqual(amounts(pricing.computeTotals(items, coupon)), expected);
    assert.deepEqual(amounts(invoice.computeInvoiceFigures({ items, coupon })), expected);
  });
}

test('invoice rounds each line tax exactly as billing does', () => {
  const items = [item({ price: 0.03 }), item({ id: 2, price: 0.03 })];
  const billed = pricing.computeTotals(items, '');
  const figures = invoice.computeInvoiceFigures({ items });
  assert.deepEqual(amounts(billed), [0.06, 0, 0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual(amounts(figures), [0.06, 0, 0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual(figures.rows.map(r => r.lineTax), [0.01, 0.01]);
});

test('CURRENT BEHAVIOUR: invoice ignores stored subtotal, discount, tax and total', () => {
  const order = { items: [item()], subtotal: 999, discount: 888, tax: 777, total: 666 };
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), [100, 0, 18, 9, 9, 118]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures({ total: 666 })), [0, 0, 0, 0, 0, 0]);
});

test('CURRENT BEHAVIOUR: historical invoice changes when current coupon configuration changes', t => {
  const order = billedOrder([item({ price: 500 })], 'SAVE10');
  const original = config.coupons.SAVE10;
  t.after(() => { config.coupons.SAVE10 = original; });
  assert.equal(invoice.computeInvoiceFigures(order).total, 531);
  config.coupons.SAVE10 = { ...original, value: 20 };
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), [500, 100, 72, 36, 36, 472]);
  assert.equal(order.total, 531);
});

test('percentage coupon invoice GST and total agree with reconciliation', () => {
  const order = billedOrder([item({ price: 500 })], 'SAVE10');
  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹81\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹531\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
  assert.deepEqual(reports.getGstReconciliation({ orders: [order] }), {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{ orderId: 1001, date: '21/11/2026', customer: 'Test customer', coupon: 'SAVE10',
      ledgerSubtotal: 500, ledgerDiscount: 50, ledgerTax: 81, ledgerTotal: 531,
      invoiceDiscount: 50, invoiceTax: 81, invoiceTotal: 531, delta: 0, matched: true }]
  });
});

for (const [total, warning] of [[118, null], [118.004, null], [117.99, '+₹0.01'], [118.01, '-₹0.01']]) {
  test('CURRENT BEHAVIOUR: rendered mismatch threshold for recorded total ' + total, () => {
    const html = invoice.render({ ...billedOrder([item()]), total });
    if (warning) {
      assert.match(html, /Accountant Reconciliation Notice:/);
      assert.ok(html.includes('by ' + warning + '.'));
    } else {
      assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
    }
  });
}

test('invoice matches HSN-based khata billing (CURRENT BEHAVIOUR: route omits product gstRate)', async t => {
  const db = {
    nextOrderId: 1001, orders: [], auditLog: [],
    products: [item({ hsn: '1006', gstRate: 12, stock: 10 })],
    customers: [{ id: 7, name: 'Test customer', creditLimit: 5000, totalBilled: 0, totalSettled: 0 }]
  };
  const read = t.mock.method(store, 'read', () => db);
  const write = t.mock.method(store, 'write', value => assert.equal(value, db));
  const order = await new Promise((resolve, reject) => {
    const req = { method: 'POST', url: '/orders', body: {
      items: [{ id: 1, qty: 1 }], customerId: 7, paymentMode: 'khata'
    } };
    const res = { status(code) { assert.equal(code, 201); return this; }, json: resolve };
    orderRouter.handle(req, res, err => reject(err || new Error('Order route did not respond')));
  });
  assert.equal(read.mock.callCount(), 1);
  assert.equal(write.mock.callCount(), 1);
  assert.equal(db.orders[0], order);
  assert.deepEqual(order.items, [{ id: 1, sku: 'TEST', name: 'Test item', hsn: '1006', price: 100, qty: 1 }]);
  assert.deepEqual([order.subtotal, order.discount, order.tax, order.total], [100, 0, 5, 105]);
  assert.equal(db.customers[0].totalBilled, 105);
  assert.equal(db.customers[0].balance, 105);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), [100, 0, 5, 2.5, 2.5, 105]);
  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
});
