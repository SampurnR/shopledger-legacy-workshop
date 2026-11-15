'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const coupons = require('../lib/coupons');
const reports = require('../lib/reports');

// Hand-authored, in-memory fixtures only. Do not import store, routes, server,
// or the application database. These are ticket-equivalent examples, not a
// copy of the eight persisted orders. Expected amounts are literal assertions.
function line(price, hsn, qty = 1, extra = {}) {
  return { id: 1, name: 'Fixture item', sku: 'TEST', price, hsn, qty, ...extra };
}

function order(items, coupon = '', billed = {}, extra = {}) {
  return {
    id: 1, date: '05/01/2022', customer: 'Fixture customer',
    status: 'completed', paymentMode: 'cash', items, coupon,
    ...billed, ...extra
  };
}

function amounts(result) {
  return {
    subtotal: result.subtotal, discount: result.discount, tax: result.tax,
    cgst: result.cgst, sgst: result.sgst, total: result.total
  };
}

function ticket1002() {
  return order([line(640, '1006'), line(190, '1512', 2)], 'SAVE10', {
    subtotal: 1020, discount: 102, tax: 45.90, total: 963.90
  }, { id: 1002, customer: 'Anil Kulkarni' });
}

test('Ticket 1 regression: #1002 invoice matches billed total and GST breakdown', () => {
  const printed = invoice.computeInvoiceFigures(ticket1002());
  assert.deepEqual(amounts(printed), {
    subtotal: 1020, discount: 102, tax: 45.90,
    cgst: 22.95, sgst: 22.95, total: 963.90
  });
  assert.deepEqual(printed.rows.map(r => [r.gstPercent, r.lineTax]),
    [[5, 28.80], [5, 17.10]]);
});

test('Checkout baseline: ticket #1002 totals use discounted 5% HSN lines', () => {
  const o = ticket1002();
  const result = pricing.computeTotals(o.items, o.coupon);
  assert.deepEqual(amounts(result), {
    subtotal: 1020, discount: 102, tax: 45.90,
    cgst: 22.95, sgst: 22.95, total: 963.90
  });
  assert.deepEqual(result.lines.map(r => [r.gstPercent, r.discount, r.taxable, r.tax]),
    [[5, 64, 576, 28.80], [5, 38, 342, 17.10]]);
});

test('Invoice #1002 uses discounted HSN tax and matches checkout', () => {
  const result = invoice.computeInvoiceFigures(ticket1002());
  assert.deepEqual(amounts(result), {
    subtotal: 1020, discount: 102, tax: 45.90,
    cgst: 22.95, sgst: 22.95, total: 963.90
  });
  assert.deepEqual(result.rows.map(r => [r.gstPercent, r.lineTax]),
    [[5, 28.80], [5, 17.10]]);
});

test('Invoice #1004-equivalent respects the SAVE10 discount cap', () => {
  const o = order([line(1120, '1508', 2)], 'SAVE10');
  assert.deepEqual(amounts(pricing.computeTotals(o.items, o.coupon)), {
    subtotal: 2240, discount: 150, tax: 104.50,
    cgst: 52.25, sgst: 52.25, total: 2194.50
  });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(o)), {
    subtotal: 2240, discount: 150, tax: 104.50,
    cgst: 52.25, sgst: 52.25, total: 2194.50
  });
});

test('Invoice preserves non-coupon 5% and 12% HSN rates', () => {
  const o = order([line(100, '1006'), line(100, '0405')]);
  const checkout = pricing.computeTotals(o.items, '');
  assert.equal(checkout.tax, 17);
  assert.equal(checkout.total, 217);
  const printed = invoice.computeInvoiceFigures(o);
  assert.deepEqual(printed.rows.map(r => [r.hsn, r.gstPercent, r.lineTax]),
    [['1006', 5, 5], ['0405', 12, 12]]);
  assert.equal(printed.tax, 17);
  assert.equal(printed.total, 217);
});

test('Matching baseline: #1008-equivalent all-18% order without a coupon', () => {
  const o = order([line(500, '0902')], '', {
    subtotal: 500, discount: 0, tax: 90, total: 590
  }, { id: 1008 });
  const expected = { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590 };
  assert.deepEqual(amounts(pricing.computeTotals(o.items, '')), expected);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(o)), expected);
  assert.equal(reports.getGstReconciliation({ orders: [o] }).rows[0].matched, true);
  assert.doesNotMatch(invoice.render(o), /Accountant Reconciliation Notice/);
});

test('Invoice flat discount reduces GST taxable value', () => {
  const o = order([line(400, '0902')], 'FLAT50');
  assert.deepEqual(amounts(pricing.computeTotals(o.items, o.coupon)), {
    subtotal: 400, discount: 50, tax: 63, cgst: 31.50, sgst: 31.50, total: 413
  });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(o)), {
    subtotal: 400, discount: 50, tax: 63, cgst: 31.50, sgst: 31.50, total: 413
  });
});

test('Invoice ignores a coupon below its minimum order', () => {
  const o = order([line(100, '0902')], 'SAVE10');
  assert.equal(coupons.validate('SAVE10', 100).valid, false);
  assert.equal(pricing.computeTotals(o.items, o.coupon).discount, 0);
  const printed = invoice.computeInvoiceFigures(o);
  assert.equal(printed.discount, 0);
  assert.equal(printed.total, 118);
});

test('Invoice ignores an inactive coupon', () => {
  const o = order([line(1000, '0902')], 'DIWALI20');
  assert.equal(coupons.validate('DIWALI20', 1000).valid, false);
  assert.equal(pricing.computeTotals(o.items, o.coupon).discount, 0);
  const printed = invoice.computeInvoiceFigures(o);
  assert.equal(printed.discount, 0);
  assert.equal(printed.total, 1180);
});

test('Invoice supports decimal gstRate and explicit zero', () => {
  const o = order([
    line(100, '1006', 1, { gstRate: 0.05 }),
    line(100, '1006', 1, { gstRate: 0 })
  ]);
  assert.equal(pricing.computeTotals(o.items, '').tax, 5);
  const printed = invoice.computeInvoiceFigures(o);
  assert.deepEqual(printed.rows.map(r => [r.gstPercent, r.lineTax]), [[5, 5], [0, 0]]);
  assert.equal(printed.tax, 5);
});

test('Invoice sums rounded line taxes consistently with checkout', () => {
  const o = order([line(0.03, '0902'), line(0.03, '0902')]);
  assert.equal(pricing.computeTotals(o.items, '').tax, 0.02);
  const printed = invoice.computeInvoiceFigures(o);
  assert.deepEqual(printed.rows.map(r => r.lineTax), [0.01, 0.01]);
  assert.deepEqual(amounts(printed), {
    subtotal: 0.06, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08
  });
});

test('Printed #1002 HTML matches billed amounts without a mismatch notice', () => {
  const o = ticket1002();
  const before = structuredClone(o);
  const html = invoice.render(o);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹45\.90/);
  assert.match(html, /Coupon Discount \(SAVE10\).*?-₹102\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹963\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.deepEqual(o, before);
});

test('GST reconciliation matches #1002 invoice and billed amounts', () => {
  const db = { orders: [ticket1002()] };
  const before = structuredClone(db);
  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{
      orderId: 1002, date: '05/01/2022', customer: 'Anil Kulkarni', coupon: 'SAVE10',
      ledgerSubtotal: 1020, ledgerDiscount: 102, ledgerTax: 45.90, ledgerTotal: 963.90,
      invoiceDiscount: 102, invoiceTax: 45.90, invoiceTotal: 963.90,
      delta: 0, matched: true
    }]
  });
  assert.deepEqual(db, before);
});

test('CURRENT BEHAVIOUR: tax-only discrepancy flags GST audit but not the invoice notice', () => {
  const o = order([line(100, '0902')], '', {
    subtotal: 100, discount: 0, tax: 17, total: 118
  });
  const result = reports.getGstReconciliation({ orders: [o] });
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].matched, false);
  assert.doesNotMatch(invoice.render(o), /Accountant Reconciliation Notice/);
});
