const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');

function bill(items, coupon = '') {
  const totals = pricing.computeTotals(items, coupon);
  const db = { nextOrderId: 1001, orders: [] };
  const order = orders.add(db, { ...totals, items, coupon, date: '2026-11-28' });
  return { totals, order, figures: invoice.computeInvoiceFigures(order) };
}

test('invoice and billed totals agree for an undiscounted item at the default rate', () => {
  const { order, figures } = bill([{ name: 'Tea', price: 100, qty: 2 }]);

  assert.equal(order.total, 236);
  assert.deepEqual(figures, {
    subtotal: 200, discount: 0, tax: 36, cgst: 18, sgst: 18, total: 236,
    rows: [{ name: 'Tea', sku: '-', hsn: '-', qty: 2, price: 100,
      gstPercent: 18, line: 200, lineTax: 36 }]
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('mixed HSN rates and SAVE10 print the amounts billed at checkout', () => {
  const { order, totals, figures } = bill([
    { name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 300, qty: 1 }
  ], 'SAVE10');

  assert.deepEqual(totals.lines.map(({ gstPercent, discount, taxable, tax }) =>
    [gstPercent, discount, taxable, tax]), [[5, 20, 180, 9], [12, 30, 270, 32.4]]);
  assert.deepEqual([order.subtotal, order.discount, order.tax, order.total], [500, 50, 41.4, 491.4]);
  assert.deepEqual([totals.cgst, totals.sgst], [20.7, 20.7]);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]),
    [[5, 9], [12, 32.4]]);
  assert.deepEqual([figures.discount, figures.tax, figures.cgst, figures.sgst, figures.total],
    [50, 41.4, 20.7, 20.7, 491.4]);

  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹41\.40/);
  assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td[^>]*>-₹50\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹491\.40/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('a flat coupon reduces both billed and printed GST', () => {
  const { order, figures } = bill([{ name: 'Tea', price: 300, qty: 1 }], 'FLAT50');

  assert.deepEqual([order.discount, order.tax, order.total], [50, 45, 295]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [50, 45, 295]);
});

test('the invoice applies the same SAVE10 cap as billing', () => {
  const { order, figures } = bill([{ name: 'Tea', price: 2000, qty: 1 }], 'SAVE10');

  assert.deepEqual([order.discount, order.tax, order.total], [150, 333, 2183]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [150, 333, 2183]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('the invoice uses the billed rates for zero, decimal, and percentage GST overrides', () => {
  const { totals, figures } = bill([
    { name: 'Zero-rated item', price: 100, qty: 1, gstRate: 0 },
    { name: 'Decimal-rate item', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Percentage-rate item', price: 100, qty: 1, gstRate: 12 }
  ]);

  assert.deepEqual(totals.lines.map(({ gstPercent, tax }) => [gstPercent, tax]),
    [[0, 0], [5, 5], [12, 12]]);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]),
    [[0, 0], [5, 5], [12, 12]]);
});

test('printed GST sums the same rounded line amounts as billing', () => {
  const { order, figures } = bill([
    { name: 'First item', price: 0.03, qty: 1 },
    { name: 'Second item', price: 0.03, qty: 1 }
  ]);

  assert.deepEqual(figures.rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.deepEqual([order.tax, order.total], [0.02, 0.08]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total],
    [0.02, 0.01, 0.01, 0.08]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('the reconciliation notice still reports a different recorded total', () => {
  const { order } = bill([{ name: 'Tea', price: 100, qty: 1 }]);

  const html = invoice.render({ ...order, total: 120 });
  assert.match(html, /recorded total \(₹120\.00\) by -₹2\.00\./);
});
