const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function recordOrder(items, coupon = '') {
  const db = { nextOrderId: 1, orders: [] };
  const billed = pricing.computeTotals(items, coupon);
  const order = orders.add(db, {
    date: '2026-11-21',
    items,
    coupon,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });
  return { db, order, billed, printed: invoice.computeInvoiceFigures(order) };
}

test('invoice matches billing at the default rate without a coupon', () => {
  const { order, printed } = recordOrder([{ name: 'Tea', price: 50, qty: 2 }]);

  assert.equal(order.total, 118);
  assert.deepEqual(printed, {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118,
    rows: [{
      name: 'Tea', sku: '-', hsn: '-', qty: 2, price: 50,
      gstPercent: 18, line: 100, lineTax: 18
    }]
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice resolves HSN slabs without a coupon', () => {
  const { printed } = recordOrder([
    { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
  ]);

  assert.deepEqual(printed.rows.map(({ gstPercent, lineTax }) =>
    [gstPercent, lineTax]), [[5, 5], [12, 12]]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total], [17, 8.5, 8.5, 217]);
});

test('a flat coupon reduces taxable value and invoice GST', () => {
  const { order, billed, printed } = recordOrder([
    { name: 'Tea', price: 500, qty: 1 }
  ], 'FLAT50');

  assert.deepEqual([billed.discount, billed.taxable, order.tax, order.total], [50, 450, 81, 531]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [50, 81, 531]);
});

test('invoice honors zero and decimal GST rate overrides', () => {
  const { billed, printed } = recordOrder([
    { name: 'Zero rate', price: 100, qty: 1, gstRate: 0 },
    { name: 'Decimal rate', price: 100, qty: 1, gstRate: 0.05 }
  ]);

  assert.deepEqual(billed.lines.map(({ gstPercent, tax }) =>
    [gstPercent, tax]), [[0, 0], [5, 5]]);
  assert.deepEqual(printed.rows.map(({ gstPercent, lineTax }) =>
    [gstPercent, lineTax]), [[0, 0], [5, 5]]);
  assert.deepEqual([billed.total, printed.total], [205, 205]);
});

test('invoice totals use the rounded line taxes from checkout', () => {
  const { order, billed, printed } = recordOrder([
    { name: 'First item', price: 0.10, qty: 1, gstRate: 5 },
    { name: 'Second item', price: 0.10, qty: 1, gstRate: 5 }
  ]);

  assert.deepEqual(printed.rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.deepEqual([order.tax, billed.cgst, billed.sgst, order.total], [0.02, 0.01, 0.01, 0.22]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total], [0.02, 0.01, 0.01, 0.22]);

  order.total = 0.23;
  assert.match(invoice.render(order), /recorded total \(₹0\.23\) by -₹0\.01/);
});

test('CURRENT BEHAVIOUR: reconciliation flags a tax-only difference without an invoice warning', () => {
  const { db, order } = recordOrder([{ name: 'Tea', price: 100, qty: 1 }]);
  order.tax = 17.99;

  const report = reports.getGstReconciliation(db);
  assert.equal(report.mismatchCount, 1);
  assert.equal(report.totalDelta, 0);
  assert.equal(report.rows[0].matched, false);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice amounts match the recorded mixed-GST order with a capped coupon', () => {
  const { db, order, printed } = recordOrder([
    { name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ], 'SAVE10');

  assert.equal(printed.total, 2007.25);
  assert.deepEqual(
    [printed.subtotal, printed.discount, printed.tax, printed.cgst, printed.sgst],
    [2000, 150, 157.25, 78.63, 78.62]
  );
  assert.deepEqual(printed.rows.map(({ gstPercent, lineTax }) =>
    [gstPercent, lineTax]), [[5, 46.25], [12, 111]]);
  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.equal(reports.getGstReconciliation(db).mismatchCount, 0);
});
