const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function recordOrder(items, coupon = '') {
  const billing = pricing.computeTotals(items, coupon);
  const db = { nextOrderId: 1, orders: [] };
  const order = orders.add(db, {
    date: '2026-01-01',
    items,
    coupon,
    ...billing
  });
  return { billing, db, order };
}

function figures({ subtotal, discount, tax, cgst, sgst, total }) {
  return { subtotal, discount, tax, cgst, sgst, total };
}

test('printable invoice shows the billed discount, total and GST for a mixed-HSN order with SAVE10', () => {
  const { order } = recordOrder([
    { name: 'Rice', hsn: '1006', price: 1000, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ], 'SAVE10');

  const html = invoice.render(order);
  const printed = {
    discount: Number(html.match(/Coupon Discount \(SAVE10\)<\/td><td[^>]*>-\D*([\d.]+)/)[1]),
    tax: Number(html.match(/Total GST\)<\/td><td class="r">[^\d<]*([\d.]+)/)[1]),
    total: Number(html.match(/Invoice Total<\/td><td class="r">[^\d<]*([\d.]+)/)[1])
  };
  assert.deepEqual(printed, { discount: order.discount, tax: order.tax, total: order.total });
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice and billing agree on an undiscounted order at the default GST rate', () => {
  const { order, billing } = recordOrder([{ name: 'Tea', price: 50, qty: 2 }]);
  const expected = { subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118 };

  assert.deepEqual(figures(billing), expected);
  assert.deepEqual(figures(invoice.computeInvoiceFigures(order)), expected);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice applies HSN slabs and the percentage coupon cap', () => {
  const { billing, order } = recordOrder([
    { id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 2 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ], 'SAVE10');

  assert.deepEqual(
    billing.lines.map(({ gstPercent, discount, taxable, tax }) => [gstPercent, discount, taxable, tax]),
    [[5, 100, 1900, 95], [12, 50, 950, 114]]
  );
  assert.equal(order.discount, 150);
  assert.equal(order.tax, 209);
  assert.equal(order.total, 3059);

  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures(printed), {
    subtotal: 3000, discount: 150, tax: 209, cgst: 104.5, sgst: 104.5, total: 3059
  });
  assert.deepEqual(
    printed.rows.map(({ hsn, gstPercent, lineTax }) => [hsn, gstPercent, lineTax]),
    [['1006', 5, 95], ['0405', 12, 114]]
  );
});

test('a flat coupon reduces taxable value in billing and on the invoice', () => {
  const { order, billing } = recordOrder([{ name: 'Tea', price: 400, qty: 1 }], 'FLAT50');

  assert.deepEqual(figures(billing), {
    subtotal: 400, discount: 50, tax: 63, cgst: 31.5, sgst: 31.5, total: 413
  });
  assert.deepEqual(figures(invoice.computeInvoiceFigures(order)), {
    subtotal: 400, discount: 50, tax: 63, cgst: 31.5, sgst: 31.5, total: 413
  });
});

test('invoice GST matches billing and reconciles when the WELCOME coupon is applied', () => {
  const { db, order } = recordOrder([{ name: 'Tea', price: 100, qty: 1 }], 'WELCOME');
  assert.equal(order.discount, 5);
  assert.equal(order.tax, 17.1);
  assert.equal(order.total, 112.1);

  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(printed.discount, 5);
  assert.equal(printed.tax, 17.1);
  assert.equal(printed.total, 112.1);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);

  const reconciliation = reports.getGstReconciliation(db);
  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});

test('invoice honours zero, decimal and whole-percent GST overrides on stored lines', () => {
  const { order, billing } = recordOrder([
    { name: 'Zero-rated item', price: 100, qty: 1, gstRate: 0 },
    { name: 'Decimal-rate item', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Whole-percent item', price: 100, qty: 1, gstRate: 12 }
  ]);

  assert.deepEqual(billing.lines.map(({ gstPercent, tax }) => [gstPercent, tax]),
    [[0, 0], [5, 5], [12, 12]]);
  assert.equal(order.total, 317);

  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(printed.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]),
    [[0, 0], [5, 5], [12, 12]]);
  assert.equal(printed.tax, 17);
  assert.equal(printed.total, 317);
});

test('invoice GST adds up from the rounded line GST amounts', () => {
  const { order, billing } = recordOrder([
    { name: 'A', price: 0.03, qty: 1 },
    { name: 'B', price: 0.03, qty: 1 }
  ]);

  assert.deepEqual(figures(billing), {
    subtotal: 0.06, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08
  });
  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(printed.rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.deepEqual(figures(printed), {
    subtotal: 0.06, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08
  });
});
