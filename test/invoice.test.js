const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function createBilledOrder() {
  // Match the order route's line shape: it stores HSN and omits gstRate.
  const items = [
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ];
  const coupon = 'SAVE10';
  const totals = pricing.computeTotals(items, coupon);
  const db = { nextOrderId: 101, orders: [] };
  const order = orders.add(db, { ...totals, items, coupon, date: '28/11/2026' });
  return { db, order, totals };
}

test('billing caps the coupon and computes GST on the discounted lines', () => {
  const { order, totals } = createBilledOrder();
  assert.deepEqual(
    totals.lines.map(({ gstPercent, discount, taxable, tax }) => (
      { gstPercent, discount, taxable, tax }
    )),
    [
      { gstPercent: 5, discount: 75, taxable: 925, tax: 46.25 },
      { gstPercent: 12, discount: 75, taxable: 925, tax: 111 }
    ]
  );
  assert.deepEqual(
    [order.subtotal, order.discount, order.tax, order.total, totals.cgst, totals.sgst],
    [2000, 150, 157.25, 2007.25, 78.63, 78.62]
  );
});

test('invoice matches the billed total, GST split, and discounted line taxes', () => {
  const { order } = createBilledOrder();
  const { subtotal, discount, tax, cgst, sgst, total, rows } = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ subtotal, discount, tax, cgst, sgst, total }, {
    subtotal: 2000, discount: 150, tax: 157.25, cgst: 78.63, sgst: 78.62, total: 2007.25
  });
  assert.deepEqual(rows.map(({ hsn, gstPercent, lineTax }) => ({ hsn, gstPercent, lineTax })), [
    { hsn: '1006', gstPercent: 5, lineTax: 46.25 },
    { hsn: '0405', gstPercent: 12, lineTax: 111 }
  ]);
});

test('invoice handles percentage, fractional, and zero GST rates like billing', () => {
  const items = [5, 0.05, 0].map(gstRate => ({ gstRate, price: 100, qty: 1 }));
  const totals = pricing.computeTotals(items);
  const figures = invoice.computeInvoiceFigures({ items });

  assert.deepEqual(totals.lines.map(line => line.tax), [5, 5, 0]);
  assert.deepEqual(figures.rows.map(row => row.gstPercent), [5, 5, 0]);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [5, 5, 0]);
});

test('invoice sums rounded line GST the same way as billing', () => {
  const items = [{ price: 0.03, qty: 1 }, { price: 0.03, qty: 1 }];
  const billed = pricing.computeTotals(items);
  const figures = invoice.computeInvoiceFigures({ items });

  assert.deepEqual(figures.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual([billed.tax, billed.total], [0.02, 0.08]);
});

test('printable invoice shows the billed GST and total without a ledger warning', () => {
  const { order } = createBilledOrder();
  const html = invoice.render(order);

  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('reconciliation matches the billed order and still flags a GST-only difference', () => {
  const { db, order } = createBilledOrder();
  db.orders.push({
    ...order,
    id: 102,
    items: [{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }],
    coupon: '',
    subtotal: 100,
    discount: 0,
    tax: 17,
    total: 118
  });
  const { totalChecked, mismatchCount, totalDelta, rows } = reports.getGstReconciliation(db);

  assert.deepEqual({ totalChecked, mismatchCount, totalDelta }, {
    totalChecked: 2, mismatchCount: 1, totalDelta: 0
  });
  assert.deepEqual(rows.map(({ ledgerTax, invoiceTax, delta, matched }) => (
    { ledgerTax, invoiceTax, delta, matched }
  )), [
    { ledgerTax: 157.25, invoiceTax: 157.25, delta: 0, matched: true },
    { ledgerTax: 17, invoiceTax: 18, delta: 0, matched: false }
  ]);
});
