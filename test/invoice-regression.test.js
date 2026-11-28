'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function item(hsn, price, qty) {
  return { name: 'Fixture item', hsn, price, qty };
}

// In-memory order shapes with the saved ledger figures for the ticket examples.
const cases = [
  {
    order: { id: 1001, items: [item('0902', 140, 2), item('0713', 165, 2)],
      subtotal: 610, discount: 0, tax: 66.9, total: 676.9 },
    rows: [[18, 50.4], [5, 16.5]]
  },
  {
    order: { id: 1002, coupon: 'SAVE10', items: [item('1006', 640, 1), item('1512', 190, 2)],
      subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 },
    rows: [[5, 28.8], [5, 17.1]]
  },
  {
    order: { id: 1004, coupon: 'SAVE10', items: [item('1508', 1120, 2)],
      subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 },
    rows: [[5, 104.5]]
  },
  {
    order: { id: 1007, items: [item('0405', 450, 2), item('1512', 190, 2)],
      subtotal: 1280, discount: 0, tax: 127, total: 1407 },
    rows: [[12, 108], [5, 19]]
  },
  {
    order: { id: 1008, items: [item('0902', 140, 1), item('2106', 180, 2)],
      subtotal: 500, discount: 0, tax: 90, total: 590 },
    rows: [[18, 25.2], [18, 64.8]]
  }
];

for (const { order, rows } of cases) {
  test('invoice #' + order.id + ' matches billed totals and item GST', () => {
    const figures = invoice.computeInvoiceFigures(order);
    assert.deepEqual(
      { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total },
      { subtotal: order.subtotal, discount: order.discount, tax: order.tax, total: order.total }
    );
    assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), rows);

    const html = invoice.render(order);
    assert.ok(html.includes('Invoice Total</td><td class="r">₹' + order.total.toFixed(2)));
    assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹' + order.tax.toFixed(2)));
    for (const [rate, tax] of rows) {
      assert.ok(html.includes('<td class="r">' + rate + '%</td><td class="r">₹' + tax.toFixed(2)));
    }
    assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  });
}

test('GST reconciliation finds no discrepancies in the five ticket examples', () => {
  const result = reports.getGstReconciliation({ orders: cases.map(({ order }) => order) });
  assert.equal(result.totalChecked, 5);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.ok(result.rows.every(row => row.matched));
});

test('historical rice invoice preserves the evidenced flat 18% checkout tax', () => {
  const order = {
    id: 1, items: [item('1006', 640, 1)],
    subtotal: 640, discount: 0, tax: 115.2, total: 755.2
  };
  const result = invoice.computeInvoiceFigures(order);
  assert.deepEqual([result.tax, result.total], [115.2, 755.2]);
  assert.deepEqual(result.rows.map(row => [row.gstPercent, row.lineTax]), [[18, 115.2]]);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 0);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('historical flat GST reproduces checkout rounding at the order level', () => {
  const order = {
    items: Array.from({ length: 3 }, () => item('1006', 0.1, 1)),
    subtotal: 0.3, discount: 0, tax: 0.05, total: 0.35
  };
  const result = invoice.computeInvoiceFigures(order);
  assert.deepEqual([result.tax, result.cgst, result.sgst, result.total], [0.05, 0.03, 0.02, 0.35]);
  assert.deepEqual(result.rows.map(row => [row.gstPercent, row.lineTax]),
    [[18, 0.02], [18, 0.02], [18, 0.01]]);
});

test('invoice preserves the saved flat discount when current coupon eligibility changes', () => {
  const config = require('../config');
  const coupon = config.coupons.FLAT50;
  const originalMinimum = coupon.minOrder;
  const order = {
    items: [item('1006', 120, 1), item('0405', 180, 1)],
    coupon: 'FLAT50', subtotal: 300, discount: 50, tax: 23, total: 273
  };

  try {
    coupon.minOrder = 400;
    const result = invoice.computeInvoiceFigures(order);
    assert.deepEqual([result.discount, result.tax, result.total], [50, 23, 273]);
    assert.deepEqual(result.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 5], [12, 18]]);
    assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 0);
  } finally {
    coupon.minOrder = originalMinimum;
  }
});

test('reconciliation still flags an order that matches neither supported GST calculation', () => {
  const order = {
    id: 1, items: [item('1006', 640, 1)],
    subtotal: 640, discount: 0, tax: 100, total: 740
  };
  const result = invoice.computeInvoiceFigures(order);
  assert.deepEqual([result.tax, result.total], [32, 672]);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 1);
  assert.match(invoice.render(order), /Accountant Reconciliation Notice/);
});

function line(price, fields = {}) {
  return { name: 'Fixture item', price, qty: 1, ...fields };
}

function billedOrder(items, coupon = '') {
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  return { id: 1, items, coupon, subtotal, discount, tax, total };
}

test('invoice resolves HSN-only GST slabs and matches the billed total', () => {
  // New order lines contain HSN but do not carry a gstRate.
  const order = billedOrder(['1006', '0405', '0902'].map(hsn => line(100, { hsn })));
  const result = invoice.computeInvoiceFigures(order);
  assert.deepEqual([order.tax, order.total], [35, 335]);
  assert.deepEqual([result.tax, result.cgst, result.sgst, result.total], [35, 17.5, 17.5, 335]);
  assert.deepEqual(result.rows.map(row => row.gstPercent), [5, 12, 18]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);

  const differentLedgerTotal = { ...order, total: 334 };
  assert.match(invoice.render(differentLedgerTotal),
    /Invoice computed total \(₹335\.00\) differs from Order Ledger recorded total \(₹334\.00\) by \+₹1\.00/);
});

test('invoice honors the billed percentage coupon cap and applies GST after discount', () => {
  const order = billedOrder([line(2000)], 'SAVE10');
  const result = invoice.computeInvoiceFigures(order);
  assert.deepEqual([order.discount, order.tax, order.total], [150, 333, 2183]);
  assert.deepEqual([result.discount, result.tax, result.total], [150, 333, 2183]);
});

test('flat discounts reduce the GST base on both the invoice and the bill', () => {
  const order = billedOrder([line(300)], 'FLAT50');
  const result = invoice.computeInvoiceFigures(order);
  assert.deepEqual([order.discount, order.tax, order.total], [50, 45, 295]);
  assert.deepEqual([result.discount, result.tax, result.total], [50, 45, 295]);
});

test('uncapped percentage coupons reconcile both total and GST', () => {
  const order = billedOrder([line(600)], 'SAVE10');
  const result = invoice.computeInvoiceFigures(order);
  assert.deepEqual([order.tax, order.total], [97.2, 637.2]);
  assert.deepEqual([result.tax, result.total], [97.2, 637.2]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);

  const report = reports.getGstReconciliation({ orders: [order] });
  assert.equal(report.totalChecked, 1);
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.rows[0].matched, true);
  assert.equal(report.rows[0].delta, 0);
  assert.equal(report.totalDelta, 0);
});

test('invoice honors explicit zero and decimal GST rates', () => {
  const order = billedOrder([
    line(100, { gstRate: 0 }),
    line(100, { gstRate: 0.12 })
  ]);
  const result = invoice.computeInvoiceFigures(order);
  assert.deepEqual([order.tax, order.total], [12, 212]);
  assert.deepEqual(result.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]),
    [[0, 0], [12, 12]]);
  assert.deepEqual([result.tax, result.total], [12, 212]);
});

test('invoice sums the same rounded line taxes as checkout', () => {
  const order = billedOrder(Array.from({ length: 3 }, () => line(0.1, { gstRate: 5 })));
  const result = invoice.computeInvoiceFigures(order);
  assert.deepEqual([order.tax, order.total], [0.03, 0.33]);
  assert.deepEqual(result.rows.map(row => row.lineTax), [0.01, 0.01, 0.01]);
  assert.deepEqual([result.tax, result.cgst, result.sgst, result.total], [0.03, 0.02, 0.01, 0.33]);
});
