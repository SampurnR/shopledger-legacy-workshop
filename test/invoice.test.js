const assert = require('node:assert/strict');
const { test } = require('node:test');
const config = require('../config');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function billedOrder(items, coupon = '') {
  const db = { nextOrderId: 1001, orders: [] };
  const totals = pricing.computeTotals(items, coupon);
  return orders.add(db, { ...totals, items, coupon, date: '2026-11-21' });
}

function assertPrintedTotals(html, gst, total) {
  assert.ok(html.includes(`CGST + SGST (Total GST)</td><td class="r">₹${gst}</td>`));
  assert.ok(html.includes(`Invoice Total</td><td class="r">₹${total}</td>`));
}

test('an undiscounted default-rate order matches the invoice and has no notice', () => {
  const order = billedOrder([{ name: 'Unclassified item', price: 50, qty: 2 }]);
  assert.equal(order.tax, 18);
  assert.equal(order.total, 118);
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118,
    rows: [{
      name: 'Unclassified item', sku: '-', hsn: '-', qty: 2, price: 50,
      gstPercent: 18, line: 100, taxable: 100, lineTax: 18
    }]
  });
  const html = invoice.render(order);
  assertPrintedTotals(html, '18.00', '118.00');
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice applies HSN slabs and apportions capped SAVE10 before GST', () => {
  const order = billedOrder([
    { name: 'Rice', sku: 'RICE', hsn: '1006', price: 500, qty: 2 },
    { name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 1000, qty: 1 }
  ], 'SAVE10');
  assert.equal(order.subtotal, 2000);
  assert.equal(order.discount, 150);
  assert.equal(order.tax, 157.25);
  assert.equal(order.total, 2007.25);

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 2000, discount: 150, tax: 157.25, cgst: 78.63, sgst: 78.62, total: 2007.25,
    rows: [
      { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 500, gstPercent: 5, line: 1000, taxable: 925, lineTax: 46.25 },
      { name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 1, price: 1000, gstPercent: 12, line: 1000, taxable: 925, lineTax: 111 }
    ]
  });

  const html = invoice.render(order);
  assertPrintedTotals(html, '157.25', '2007.25');
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice GST and total both match checkout in reconciliation', () => {
  const order = billedOrder([{ name: 'Tea', hsn: '0902', price: 500, qty: 1 }], 'SAVE10');
  assert.equal(order.discount, 50);
  assert.equal(order.tax, 81);
  assert.equal(order.total, 531);

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, 50);
  assert.equal(figures.tax, 81);
  assert.equal(figures.total, 531);
  const html = invoice.render(order);
  assertPrintedTotals(html, '81.00', '531.00');
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  const report = reports.getGstReconciliation({ orders: [order] });
  assert.equal(report.totalChecked, 1);
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.totalDelta, 0);
  assert.equal(report.rows[0].matched, true);
  assert.equal(report.rows[0].ledgerTax, 81);
  assert.equal(report.rows[0].invoiceTax, 81);
});

test('invoice uses checkout GST rates for numeric zero, decimals and percentages', () => {
  const order = billedOrder([
    { name: 'Exempt item', price: 100, qty: 1, gstRate: 0 },
    { name: 'Reduced-rate item', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Standard-rate item', price: 100, qty: 1, gstRate: 12 }
  ]);
  assert.equal(order.tax, 17);
  assert.equal(order.total, 317);

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [
    [0, 0], [5, 5], [12, 12]
  ]);
  assert.equal(figures.tax, 17);
  assert.equal(figures.total, 317);
});

test('invoice ignores a flat coupon below its minimum', () => {
  const order = billedOrder([{ name: 'Small item', price: 20, qty: 1 }]);
  // Model a stored order carrying a code the current checkout would reject.
  order.coupon = 'FLAT50';
  assert.equal(order.discount, 0);
  assert.equal(order.total, 23.6);

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, 0);
  assert.equal(figures.tax, 3.6);
  assert.equal(figures.total, 23.6);
});

test('invoice adds rounded line GST amounts', () => {
  const order = billedOrder([
    { name: 'Item A', price: 0.03, qty: 1 },
    { name: 'Item B', price: 0.03, qty: 1 }
  ]);
  assert.equal(order.tax, 0.02);
  assert.equal(order.total, 0.08);

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.equal(figures.tax, 0.02);
  assert.equal(figures.cgst, 0.01);
  assert.equal(figures.sgst, 0.01);
  assert.equal(figures.total, 0.08);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice ignores an expired percentage coupon on a stored order', () => {
  const order = billedOrder([{ name: 'Tea', hsn: '0902', price: 1500, qty: 1 }], 'DIWALI20');
  assert.equal(order.discount, 0);
  assert.equal(order.tax, 270);
  assert.equal(order.total, 1770);

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, 0);
  assert.equal(figures.tax, 270);
  assert.equal(figures.total, 1770);

  const html = invoice.render(order);
  assertPrintedTotals(html, '270.00', '1770.00');
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('printed invoice matches checkout GST and total for mixed HSN slabs with capped SAVE10', () => {
  const order = billedOrder([
    { name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ], 'SAVE10');

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.tax, order.tax, 'Invoice GST must match checkout GST');
  assert.equal(figures.total, order.total, 'Invoice total must match checkout total');
  const html = invoice.render(order);
  assertPrintedTotals(html, '157.25', '2007.25');
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('reprinting preserves the recorded discount after the coupon is deactivated', (t) => {
  const order = billedOrder([{ name: 'Rice', hsn: '1006', price: 1000, qty: 2 }], 'SAVE10');
  const coupon = config.coupons.SAVE10;
  t.after(() => { config.coupons.SAVE10 = coupon; });
  config.coupons.SAVE10 = { ...coupon, active: false };
  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('printed invoice shows the discounted taxable amount beside the GST rate and amount', () => {
  const order = billedOrder([{ name: 'Rice', hsn: '1006', price: 1000, qty: 1 }], 'SAVE10');
  const html = invoice.render(order);
  assert.match(html, />Taxable Amount<\/th>/);
  assert.match(html, /<td class="r">[^\d<]*900\.00<\/td><td class="r">5%<\/td><td class="r">[^\d<]*45\.00<\/td>/);
});

test('an order without a recorded discount falls back to coupon calculation', () => {
  const order = billedOrder([{ name: 'Rice', hsn: '1006', price: 1000, qty: 1 }], 'SAVE10');
  delete order.discount;
  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, 100);
  assert.equal(figures.total, order.total);
});
