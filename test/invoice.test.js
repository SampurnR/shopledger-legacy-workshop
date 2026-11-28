const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function billedOrder(items, coupon = '') {
  const totals = pricing.computeTotals(items, coupon);
  return orders.add({ nextOrderId: 1001, orders: [] }, {
    date: '2026-01-01',
    items,
    coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
}

test('default GST matches the billed total and splits an odd cent into CGST and SGST', () => {
  const order = billedOrder([{ name: 'Item', price: 0.50, qty: 1 }]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.total, 0.59);
  assert.equal(figures.total, 0.59);
  assert.equal(figures.tax, 0.09);
  assert.equal(figures.cgst, 0.05);
  assert.equal(figures.sgst, 0.04);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice uses HSN slabs and the capped pre-GST coupon across mixed-rate lines', () => {
  const order = billedOrder([
    { name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { name: 'Tea', hsn: '0902', price: 1000, qty: 1 }
  ], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    [order.subtotal, order.discount, order.tax, order.total],
    [2000, 150, 212.75, 2062.75]
  );
  assert.deepEqual(
    [figures.subtotal, figures.discount, figures.tax, figures.cgst, figures.sgst, figures.total],
    [2000, 150, 212.75, 106.38, 106.37, 2062.75]
  );
  assert.deepEqual(
    figures.rows.map(({ hsn, gstPercent, lineTax }) => [hsn, gstPercent, lineTax]),
    [['1006', 5, 46.25], ['0902', 18, 166.50]]
  );

  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">[^<]*212\.75<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*2062\.75<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  const report = reports.getGstReconciliation({ orders: [order] });
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.totalDelta, 0);
  assert.equal(report.rows[0].ledgerTax, 212.75);
  assert.equal(report.rows[0].invoiceTax, 212.75);
  assert.equal(report.rows[0].matched, true);
});

test('invoice handles decimal, percentage, and zero GST overrides like billing', () => {
  const order = billedOrder([
    { name: 'Decimal rate', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Percentage rate', price: 100, qty: 1, gstRate: 5 },
    { name: 'Zero rate', price: 100, qty: 1, gstRate: 0 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 10);
  assert.equal(order.total, 310);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]),
    [[5, 5], [5, 5], [0, 0]]);
  assert.equal(figures.tax, 10);
  assert.equal(figures.total, 310);
});

test('invoice sums the same rounded line GST amounts as billing', () => {
  const order = billedOrder([
    { name: 'First item', price: 0.03, qty: 1 },
    { name: 'Second item', price: 0.03, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 0.02);
  assert.equal(order.total, 0.08);
  assert.deepEqual(figures.rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.equal(figures.tax, 0.02);
  assert.equal(figures.total, 0.08);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice does not add an expired coupon discount to the recorded bill', () => {
  const order = billedOrder([{ name: 'Item', price: 100, qty: 1 }]);
  order.coupon = 'DIWALI20';
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 0);
  assert.equal(order.total, 118);
  assert.equal(figures.discount, 0);
  assert.equal(figures.total, 118);
});

test('invoice shows the billed total and GST for an HSN order with a capped coupon', () => {
  const order = billedOrder([
    { name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 3 }
  ], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.total, 1858.50);
  assert.equal(order.tax, 88.50);
  assert.deepEqual(
    { total: figures.total, tax: figures.tax, rate: figures.rows[0].gstPercent, lineTax: figures.rows[0].lineTax },
    { total: 1858.50, tax: 88.50, rate: 5, lineTax: 88.50 }
  );
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice uses the recorded discount to rebuild GST after a coupon expires', () => {
  const order = {
    items: [{ name: 'Item', price: 100, qty: 1 }],
    coupon: 'DIWALI20',
    subtotal: 100,
    discount: 20,
    tax: 14.40,
    total: 94.40
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.discount, 20);
  assert.equal(figures.rows[0].lineTax, 14.40);
  assert.equal(figures.tax, 14.40);
  assert.equal(figures.total, 94.40);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 0);
});

test('invoice prints the recorded amounts and still flags a genuine ledger discrepancy', () => {
  const order = billedOrder([{ name: 'Item', price: 100, qty: 1 }]);
  order.tax = 0;
  order.total = 100;
  const html = invoice.render(order);

  assert.match(html, /Total GST\)<\/td><td class="r">[^<]*0\.00<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*100\.00<\/td>/);
  assert.match(html, /Accountant Reconciliation Notice:.*118\.00.*100\.00/);
  const report = reports.getGstReconciliation({ orders: [order] });
  assert.equal(report.mismatchCount, 1);
  assert.equal(report.rows[0].invoiceTax, 18);
  assert.equal(report.rows[0].delta, 18);
});

test('invoice figures fall back to current pricing when recorded amounts are missing', () => {
  const order = { items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }] };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    [figures.subtotal, figures.discount, figures.tax, figures.total],
    [100, 0, 5, 105]
  );
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice warns when recorded GST differs even though the grand total matches', () => {
  const order = billedOrder([{ name: 'Item', price: 100, qty: 1 }]);
  order.tax = 0;

  assert.match(invoice.render(order), /Accountant Reconciliation Notice:.*Computed GST.*18\.00.*recorded GST.*0\.00/);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 1);
});

test('invoice subtotal matches the item lines when the recorded subtotal differs', () => {
  const order = billedOrder([{ name: 'Item', price: 100, qty: 1 }]);
  order.subtotal = 90;

  assert.match(invoice.render(order), /Gross Subtotal<\/td><td class="r">[^<]*100\.00<\/td>/);
});

test('invoice derives a missing total from the displayed GST', () => {
  const order = { items: [{ name: 'Item', price: 100, qty: 1 }], tax: 5 };
  const html = invoice.render(order);

  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*105\.00<\/td>/);
  assert.match(html, /Accountant Reconciliation Notice:.*Computed GST.*18\.00.*recorded GST.*5\.00/);
});
