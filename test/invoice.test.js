const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const orders = require('../lib/orders');
const reports = require('../lib/reports');

function checkout(items, coupon = '') {
  const totals = pricing.computeTotals(items, coupon);
  const db = { orders: [], nextOrderId: 1001 };
  const order = orders.add(db, {
    date: '15/11/2026',
    customer: 'Test customer',
    items,
    coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
  return { db, order, totals };
}

function mixedSlabCheckout() {
  return checkout([
    { id: 1, name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ], 'SAVE10');
}

test('invoice total and GST breakdown match the billed order', () => {
  const { order, totals } = mixedSlabCheckout();
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    total: figures.total,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    lines: figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax])
  }, {
    total: order.total,
    tax: order.tax,
    cgst: totals.cgst,
    sgst: totals.sgst,
    lines: [[5, 46.25], [12, 111]]
  });
});

test('checkout caps SAVE10 and applies each HSN rate after apportioning the discount', () => {
  const { order, totals } = mixedSlabCheckout();

  assert.equal(order.subtotal, 2000);
  assert.equal(order.discount, 150);
  assert.equal(totals.taxable, 1850);
  assert.deepEqual(totals.lines.map(({ gstPercent, discount, taxable, tax }) => [
    gstPercent, discount, taxable, tax
  ]), [
    [5, 75, 925, 46.25],
    [12, 75, 925, 111]
  ]);
  assert.equal(order.tax, 157.25);
  assert.equal(totals.cgst, 78.63);
  assert.equal(totals.sgst, 78.62);
  assert.equal(order.total, 2007.25);
});

test('invoice uses the capped coupon and carries over the HSN line details', () => {
  const { order } = mixedSlabCheckout();
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, 2000);
  assert.equal(figures.discount, 150);
  assert.deepEqual(figures.rows.map(({ hsn, gstPercent, lineTax }) => [
    hsn, gstPercent, lineTax
  ]), [
    ['1006', 5, 46.25],
    ['0405', 12, 111]
  ]);
});

test('invoice and checkout apply a flat coupon before GST', () => {
  const { order } = checkout([{ id: 1, name: 'Tea', hsn: '0902', price: 500, qty: 1 }], 'FLAT50');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 50);
  assert.equal(figures.discount, 50);
  assert.equal(order.tax, 81);
  assert.equal(figures.tax, 81);
  assert.equal(order.total, 531);
  assert.equal(figures.total, 531);
});

test('printable invoice shows the billed GST and total without a warning for a matching order', () => {
  const { order } = mixedSlabCheckout();
  const html = invoice.render(order);

  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>₹157\.25/);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹2007\.25/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('GST reconciliation matches a mixed-slab checkout with a coupon', () => {
  const { db } = mixedSlabCheckout();
  const result = reports.getGstReconciliation(db);

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 1001,
    date: '15/11/2026',
    customer: 'Test customer',
    coupon: 'SAVE10',
    ledgerSubtotal: 2000,
    ledgerDiscount: 150,
    ledgerTax: 157.25,
    ledgerTotal: 2007.25,
    invoiceDiscount: 150,
    invoiceTax: 157.25,
    invoiceTotal: 2007.25,
    delta: 0,
    matched: true
  });
});

test('invoice and reconciliation still flag a difference from stored historical figures', () => {
  const { db, order } = mixedSlabCheckout();
  order.total = 2000;

  assert.match(invoice.render(order), /Order Ledger recorded total \(₹2000\.00\) by \+₹7\.25/);
  const result = reports.getGstReconciliation(db);
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalDelta, 7.25);
});

test('checkout and invoice agree for an 18% item without a coupon', () => {
  const { db, order } = checkout([{ id: 1, name: 'Tea', hsn: '0902', price: 500, qty: 1 }]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.total, 590);
  assert.equal(figures.total, 590);
  assert.equal(order.tax, 90);
  assert.equal(figures.tax, 90);
  assert.equal(reports.getGstReconciliation(db).mismatchCount, 0);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
