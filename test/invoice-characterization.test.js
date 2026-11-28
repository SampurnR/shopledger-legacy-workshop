const assert = require('node:assert/strict');
const { test } = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

test('printed invoice uses the recorded amounts for #1002', () => {
  const order = {
    id: 1002, coupon: 'SAVE10', subtotal: 1020, discount: 102, tax: 45.90,
    total: 963.90,
    items: [
      { hsn: '1006', price: 640, qty: 1 },
      { hsn: '1512', price: 190, qty: 2 }
    ]
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    [figures.total, figures.tax, figures.discount, figures.cgst, figures.sgst],
    [963.90, 45.90, 102, 22.95, 22.95]
  );
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]),
    [[5, 28.80], [5, 17.10]]);
  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹963\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

// Reconstructed from the ticket's examples. Unspecified lines and orders
// are representative fixtures. Ledger amounts are fixed inputs to the audit.
const orders = [
  {
    id: 1001, coupon: '', subtotal: 200, discount: 0, tax: 17, total: 217,
    items: [
      { hsn: '1006', price: 100, qty: 1 },
      { hsn: '0405', price: 100, qty: 1 }
    ]
  },
  {
    id: 1002, coupon: 'SAVE10', subtotal: 1020, discount: 102, tax: 45.90,
    total: 963.90, items: [{ hsn: '1006', price: 510, qty: 2 }]
  },
  {
    id: 1003, coupon: '', subtotal: 200, discount: 0, tax: 10, total: 210,
    items: [{ hsn: '0713', price: 200, qty: 1 }]
  },
  {
    id: 1004, coupon: 'SAVE10', subtotal: 2240, discount: 150, tax: 104.50,
    total: 2194.50, items: [{ hsn: '1006', price: 560, qty: 4 }]
  },
  {
    id: 1005, coupon: '', subtotal: 300, discount: 0, tax: 36, total: 336,
    items: [{ hsn: '0904', price: 300, qty: 1 }]
  },
  {
    id: 1006, coupon: '', subtotal: 400, discount: 0, tax: 20, total: 420,
    items: [{ hsn: '1512', price: 400, qty: 1 }]
  },
  {
    id: 1007, coupon: '', subtotal: 500, discount: 0, tax: 60, total: 560,
    items: [{ hsn: '0405', price: 500, qty: 1 }]
  },
  {
    id: 1008, coupon: '', subtotal: 300, discount: 0, tax: 54, total: 354,
    items: [
      { hsn: '0902', price: 100, qty: 1 },
      { hsn: '0901', price: 200, qty: 1 }
    ]
  }
];

test('#1002-like SAVE10 invoice matches checkout', () => {
  const order = orders.find(({ id }) => id === 1002);
  const checkout = pricing.computeTotals(order.items, order.coupon);
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(checkout.total, 963.90);
  assert.equal(checkout.tax, 45.90);
  assert.equal(printed.total, 963.90);
  assert.equal(printed.tax, 45.90);
  assert.equal(printed.cgst, 22.95);
  assert.equal(printed.sgst, 22.95);

  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹45\.90/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹963\.90/);
});

test('#1004-like SAVE10 invoice uses the recorded capped discount', () => {
  const order = orders.find(({ id }) => id === 1004);
  const checkout = pricing.computeTotals(order.items, order.coupon);
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(checkout.discount, 150);
  assert.equal(printed.discount, 150);
});

test('non-coupon invoice uses the 5% and 12% HSN rates', () => {
  const order = orders.find(({ id }) => id === 1001);
  const checkout = pricing.computeTotals(order.items, order.coupon);
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(checkout.lines.map(({ gstPercent }) => gstPercent), [5, 12]);
  assert.deepEqual(printed.rows.map(({ gstPercent }) => gstPercent), [5, 12]);
  assert.equal(checkout.tax, 17);
  assert.equal(printed.tax, 17);
});

test('CURRENT BEHAVIOUR: #1008-like all-18% order matches without a coupon', () => {
  const order = orders.find(({ id }) => id === 1008);
  const checkout = pricing.computeTotals(order.items, order.coupon);
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(checkout.tax, 54);
  assert.equal(printed.tax, 54);
  assert.equal(checkout.total, 354);
  assert.equal(printed.total, 354);
});

test('GST Audit matches all eight representative orders', () => {
  const report = reports.getGstReconciliation({ orders });

  assert.equal(report.totalChecked, 8);
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.totalDelta, 0);
  assert.ok(report.rows.every(({ matched }) => matched));
});
