const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function bill(items, coupon = '') {
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  return { id: 1, date: '2021-11-01', items, coupon, subtotal, discount, tax, total };
}

test('An undiscounted 18% item agrees on the bill and the invoice', () => {
  const order = bill([{ name: 'Tea', hsn: '0902', price: 25, qty: 2 }]);
  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(order.total, 59);
  assert.equal(order.tax, 9);
  assert.deepEqual([printed.subtotal, printed.discount, printed.tax, printed.cgst,
    printed.sgst, printed.total], [50, 0, 9, 4.5, 4.5, 59]);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).rows[0].matched, true);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('A mixed-rate flat-discount invoice reconciles with the billed order', () => {
  const order = bill([
    { name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 300, qty: 1 }
  ], 'FLAT50');
  const row = reports.getGstReconciliation({ orders: [order] }).rows[0];
  assert.equal(row.matched, true);
});

test('The invoice applies each HSN slab after allocating the flat discount', () => {
  const items = [
    { name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 300, qty: 1 }
  ];
  const order = bill(items, 'FLAT50');
  const billed = pricing.computeTotals(items, order.coupon);
  assert.deepEqual(billed.lines.map(line =>
    [line.gstPercent, line.discount, line.taxable, line.tax]), [
    [5, 20, 180, 9],
    [12, 30, 270, 32.4]
  ]);
  assert.deepEqual([billed.cgst, billed.sgst, billed.total], [20.7, 20.7, 491.4]);

  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(printed.rows.map(row => [row.gstPercent, row.line, row.lineTax]),
    [[5, 200, 9], [12, 300, 32.4]]);
  assert.deepEqual([printed.subtotal, printed.discount, printed.tax, printed.cgst,
    printed.sgst, printed.total], [500, 50, 41.4, 20.7, 20.7, 491.4]);
  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>₹41\.40/);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹491\.40/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('A percentage coupon reconciles both GST and the grand total', () => {
  const order = bill([{ name: 'Tea', hsn: '0902', price: 500, qty: 1 }], 'SAVE10');
  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual([order.discount, order.tax, order.total], [50, 81, 531]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [50, 81, 531]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  const report = reports.getGstReconciliation({ orders: [order] });
  assert.equal(report.rows[0].matched, true);
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.totalDelta, 0);
});

test('Invoice GST sums the rounded row taxes', () => {
  const items = ['Tea', 'Coffee'].map(name => ({ name, price: 0.03, qty: 1 }));
  const order = bill(items);
  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual([order.tax, order.total], [0.02, 0.08]);
  assert.deepEqual(printed.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total],
    [0.02, 0.01, 0.01, 0.08]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

for (const [rate, billedTax] of [[0, 0], [0.05, 5], [12, 12]]) {
  test(`An explicit gstRate ${rate} prints ₹${billedTax} GST on ₹100`, () => {
    const order = bill([{ name: 'Rice', hsn: '1006', gstRate: rate, price: 100, qty: 1 }]);
    assert.equal(order.tax, billedTax);
    const printed = invoice.computeInvoiceFigures(order);
    assert.equal(printed.tax, billedTax);
    assert.equal(printed.rows[0].gstPercent, Math.round(billedTax));
  });
}

// Stored orders can carry coupon codes that today's checkout would reject or normalize.
for (const [scenario, coupon, price, billedDiscount, printedTotal] of [
  ['honors the percentage cap', 'SAVE10', 2000, 150, 2183],
  ['skips the flat coupon below its minimum', 'FLAT50', 10, 0, 11.8],
  ['skips an expired coupon', 'DIWALI20', 1000, 0, 1180],
  ['normalizes the stored code', ' save10 ', 500, 50, 531]
]) {
  test(`The invoice ${scenario}`, () => {
    const order = bill([{ name: 'Tea', price, qty: 1 }], coupon);
    assert.equal(order.discount, billedDiscount);
    const printed = invoice.computeInvoiceFigures(order);
    assert.equal(printed.discount, billedDiscount);
    assert.equal(printed.total, printedTotal);
  });
}
