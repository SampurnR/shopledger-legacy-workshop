'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

// Deliberately do not import server, routers, or store. All records are synthetic
// in-memory fixtures. CURRENT BEHAVIOUR cases remain unchanged; REGRESSION cases
// replace the old invoice discrepancies intentionally fixed by this ticket.
function item(overrides = {}) {
  return { id: 1, sku: 'TEST-1', name: 'Test product', hsn: '0902',
    price: 100, qty: 1, ...overrides };
}

function billedOrder(items, coupon = '') {
  const billed = pricing.computeTotals(items, coupon);
  // Persisted monetary fields and item shape used by routes/orders.js.
  return { id: 9001, date: '22/11/2026', customer: 'Test customer',
    paymentMode: 'cash', status: 'completed', items, coupon,
    subtotal: billed.subtotal, discount: billed.discount,
    tax: billed.tax, total: billed.total };
}

function amounts(figures) {
  const { subtotal, discount, tax, total } = figures;
  return { subtotal, discount, tax, total };
}

test('CURRENT BEHAVIOUR: an undiscounted 18% item agrees with billed totals', () => {
  const order = billedOrder([item()]);
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(amounts(order), { subtotal: 100, discount: 0, tax: 18, total: 118 });
  assert.deepEqual(figures, {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118,
    rows: [{ name: 'Test product', sku: 'TEST-1', hsn: '0902', qty: 1,
      price: 100, gstPercent: 18, line: 100, lineTax: 18 }]
  });
});

test('REGRESSION: invoice honors mixed HSN slabs used in billing', () => {
  const order = billedOrder([
    item({ hsn: '1006' }),
    item({ id: 2, hsn: '0405' }),
    item({ id: 3, hsn: '0902' })
  ]);
  assert.deepEqual(amounts(order), { subtotal: 300, discount: 0, tax: 35, total: 335 });
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(amounts(figures), { subtotal: 300, discount: 0, tax: 35, total: 335 });
  assert.deepEqual(figures.rows.map(row => row.gstPercent), [5, 12, 18]);
  assert.deepEqual([figures.cgst, figures.sgst], [17.5, 17.5]);
});

test('REGRESSION: SAVE10 invoice discount and GST both match billing', () => {
  const order = billedOrder([item({ price: 500 })], 'SAVE10');
  assert.deepEqual(amounts(order), { subtotal: 500, discount: 50, tax: 81, total: 531 });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)),
    { subtotal: 500, discount: 50, tax: 81, total: 531 });
});

test('REGRESSION: invoice respects the SAVE10 maximum discount', () => {
  const order = billedOrder([item({ price: 2000 })], 'SAVE10');
  assert.deepEqual(amounts(order), { subtotal: 2000, discount: 150, tax: 333, total: 2183 });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)),
    { subtotal: 2000, discount: 150, tax: 333, total: 2183 });
});

test('REGRESSION: flat discount reduces invoice taxable value as in billing', () => {
  const order = billedOrder([item({ price: 300 })], 'FLAT50');
  assert.deepEqual(amounts(order), { subtotal: 300, discount: 50, tax: 45, total: 295 });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)),
    { subtotal: 300, discount: 50, tax: 45, total: 295 });
});

// Below-minimum, inactive and unnormalized coupons are historical/direct-module
// inputs. Order placement validates/normalizes coupons before saving new orders.
test('REGRESSION: invoice ignores SAVE10 below its minimum subtotal', () => {
  const order = billedOrder([item()], 'SAVE10');
  assert.deepEqual(amounts(order), { subtotal: 100, discount: 0, tax: 18, total: 118 });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)),
    { subtotal: 100, discount: 0, tax: 18, total: 118 });
});

test('REGRESSION: invoice ignores the inactive DIWALI20 coupon', () => {
  const order = billedOrder([item({ price: 1000 })], 'DIWALI20');
  assert.deepEqual(amounts(order), { subtotal: 1000, discount: 0, tax: 180, total: 1180 });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)),
    { subtotal: 1000, discount: 0, tax: 180, total: 1180 });
});

test('REGRESSION: invoice normalizes a stored coupon code as billing does', () => {
  const order = billedOrder([item({ price: 500 })], ' save10 ');
  assert.deepEqual(amounts(order), { subtotal: 500, discount: 50, tax: 81, total: 531 });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)),
    { subtotal: 500, discount: 50, tax: 81, total: 531 });
});

test('REGRESSION: invoice does not apply an ineligible flat discount to a tiny order', () => {
  const order = billedOrder([item({ price: 10 })], 'FLAT50');
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)),
    { subtotal: 10, discount: 0, tax: 1.8, total: 11.8 });
});

test('CURRENT BEHAVIOUR: a numeric percentage GST override works in both calculations', () => {
  const order = billedOrder([item({ gstRate: 5 })]);
  assert.deepEqual(amounts(order), { subtotal: 100, discount: 0, tax: 5, total: 105 });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), amounts(order));
});

test('REGRESSION: invoice preserves an explicit zero GST rate', () => {
  const order = billedOrder([item({ gstRate: 0 })]);
  assert.deepEqual(amounts(order), { subtotal: 100, discount: 0, tax: 0, total: 100 });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)),
    { subtotal: 100, discount: 0, tax: 0, total: 100 });
});

test('REGRESSION: invoice supports decimal GST rates as billing does', () => {
  const order = billedOrder([item({ gstRate: 0.05 })]);
  assert.deepEqual(amounts(order), { subtotal: 100, discount: 0, tax: 5, total: 105 });
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(amounts(figures), { subtotal: 100, discount: 0, tax: 5, total: 105 });
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('REGRESSION: invoice totals sum rounded line GST like billing', () => {
  const order = billedOrder([1, 2, 3].map(id => item({ id, price: 0.03 })));
  assert.deepEqual(amounts(order), { subtotal: 0.09, discount: 0, tax: 0.03, total: 0.12 });
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(amounts(figures), { subtotal: 0.09, discount: 0, tax: 0.03, total: 0.12 });
  assert.deepEqual(figures.rows.map(row => row.lineTax), [0.01, 0.01, 0.01]);
  assert.deepEqual([figures.cgst, figures.sgst], [0.02, 0.01]);
});

test('REGRESSION: odd-paise CGST and SGST split matches billing', () => {
  const lines = [item({ price: 0.03 })];
  const billed = pricing.computeTotals(lines, '');
  const figures = invoice.computeInvoiceFigures(billedOrder(lines));
  assert.deepEqual([billed.tax, billed.cgst, billed.sgst], [0.01, 0.01, 0]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst], [0.01, 0.01, 0]);
});

test('CURRENT BEHAVIOUR: invoice recalculates amounts instead of using saved monetary fields', () => {
  const order = { ...billedOrder([item()]), subtotal: 900, discount: 20, tax: 119, total: 999 };
  const before = structuredClone(order);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)),
    { subtotal: 100, discount: 0, tax: 18, total: 118 });
  assert.deepEqual(order, before);
  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">\u20b9118\.00/);
  assert.match(html, /Order Ledger recorded total \(\u20b9999\.00\)/);
  assert.match(html, /Accountant Reconciliation Notice:/);
  assert.deepEqual(order, before);
});

test('REGRESSION: rice invoice HTML displays billed total and GST without a mismatch', () => {
  const order = billedOrder([item({ hsn: '1006' })]);
  const html = invoice.render(order);
  assert.equal(order.total, 105);
  assert.match(html, /Invoice Total<\/td><td class="r">\u20b9105\.00/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">\u20b95\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
});

test('REGRESSION: SAVE10 reconciliation agrees on both invoice total and tax', () => {
  const order = billedOrder([item({ price: 500 })], 'SAVE10');
  const before = structuredClone(order);
  const result = reports.getGstReconciliation({ orders: [order] });
  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 9001, date: '22/11/2026', customer: 'Test customer', coupon: 'SAVE10',
    ledgerSubtotal: 500, ledgerDiscount: 50, ledgerTax: 81, ledgerTotal: 531,
    invoiceDiscount: 50, invoiceTax: 81, invoiceTotal: 531, delta: 0, matched: true
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice:/);
  assert.deepEqual(order, before);
});
