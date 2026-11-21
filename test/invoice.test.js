const { test } = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function rice(price, fields = {}) {
  return { id: 1, name: 'Rice', hsn: '1006', price, qty: 1, ...fields };
}

function bill(items, coupon = '') {
  const totals = pricing.computeTotals(items, coupon);
  const db = { orders: [], nextOrderId: 1 };
  const order = orders.add(db, { ...totals, items, coupon, date: '2021-11-01' });
  return { totals, order, figures: invoice.computeInvoiceFigures(order) };
}

test('an 18% HSN order agrees on GST and payable total and prints no notice', () => {
  const { order, figures } = bill([rice(50, { name: 'Tea', hsn: '0902', qty: 2 })]);
  assert.equal(order.tax, 18);
  assert.equal(order.total, 118);
  assert.equal(figures.tax, 18);
  assert.equal(figures.total, 118);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('an HSN-only rice order is billed and printed at 5%', () => {
  const { totals, order, figures } = bill([rice(100)]);
  assert.equal(totals.lines[0].gstPercent, 5);
  assert.deepEqual([order.tax, totals.cgst, totals.sgst, order.total], [5, 2.5, 2.5, 105]);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 5);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [5, 2.5, 2.5, 105]);

  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>₹5\.00</);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹105\.00</);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

for (const [rate, percent] of [[0, 0], [0.05, 5]]) {
  test(`explicit gstRate ${rate} prints the billed rate of ${percent}%`, () => {
    const { order, figures } = bill([rice(100, { gstRate: rate })]);
    assert.equal(order.tax, percent);
    assert.equal(figures.rows[0].gstPercent, percent);
    assert.equal(figures.tax, percent);
  });
}

test('FLAT50 reduces the taxable value of each invoice line proportionally', () => {
  const { totals, order, figures } = bill([
    rice(100, { gstRate: 5 }),
    { id: 2, name: 'Ghee', price: 400, qty: 1, gstRate: 12 },
  ], 'FLAT50');
  assert.deepEqual(totals.lines.map(line => [line.discount, line.taxable, line.tax]),
    [[10, 90, 4.5], [40, 360, 43.2]]);
  assert.deepEqual([order.discount, order.tax, order.total], [50, 47.7, 497.7]);
  assert.deepEqual(figures.rows.map(line => line.lineTax), [4.5, 43.2]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [50, 47.7, 497.7]);
});

for (const [subtotal, discount, tax, total] of [
  [500, 50, 81, 531],
  [1500, 150, 243, 1593],
  [2000, 150, 333, 2183],
]) {
  test(`SAVE10 on ₹${subtotal} prints the billed discount of ₹${discount}`, () => {
    const { order, figures } = bill([rice(subtotal, { gstRate: 18 })], 'SAVE10');
    assert.deepEqual([order.discount, order.tax, order.total], [discount, tax, total]);
    assert.deepEqual([figures.discount, figures.tax, figures.total], [discount, tax, total]);
    assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  });
}

test('invoice sums rounded line GST when each line rounds to zero', () => {
  const { totals, order, figures } = bill([
    rice(0.08, { gstRate: 5 }),
    { id: 2, name: 'Dal', price: 0.08, qty: 1, gstRate: 5 },
  ]);
  assert.deepEqual(totals.lines.map(line => line.tax), [0, 0]);
  assert.deepEqual([order.tax, order.total], [0, 0.16]);
  assert.deepEqual(figures.rows.map(line => line.lineTax), [0, 0]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [0, 0, 0, 0.16]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('SAVE10 on ₹1,020 of rice prints the billed GST and total for #1002', () => {
  const { order, totals, figures } = bill([rice(510, { qty: 2 })], 'SAVE10');
  assert.deepEqual([order.discount, totals.cgst, totals.sgst, order.tax, order.total],
    [102, 22.95, 22.95, 45.90, 963.90]);
  assert.deepEqual([figures.discount, figures.cgst, figures.sgst, figures.tax, figures.total],
    [102, 22.95, 22.95, 45.90, 963.90]);

  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>₹45\.90</);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹963\.90</);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  const [row] = reports.getGstReconciliation({ orders: [order] }).rows;
  assert.deepEqual([row.ledgerTax, row.invoiceTax, row.delta, row.matched],
    [45.90, 45.90, 0, true]);
});

test('SAVE10 on a ₹2,240 subtotal caps the invoice discount at ₹150', () => {
  const { order, figures } = bill([rice(2240)], 'SAVE10');
  assert.equal(order.discount, 150);
  assert.equal(figures.discount, 150);
});

test('GST Audit reconciles all three HSN slabs and still detects a ledger tax discrepancy', () => {
  const cases = [
    bill([rice(100)]),
    bill([rice(100, { name: 'Ghee', hsn: '0405' })]),
    bill([rice(100, { name: 'Tea', hsn: '0902' })]),
    bill([rice(500, { name: 'Tea', hsn: '0902' })], 'SAVE10'),
  ];
  cases[3].order.tax += 0.01;
  const audit = reports.getGstReconciliation({ orders: cases.map(entry => entry.order) });
  assert.deepEqual(audit.rows.map(row => [row.ledgerTax, row.invoiceTax, row.delta, row.matched]), [
    [5, 5, 0, true],
    [12, 12, 0, true],
    [18, 18, 0, true],
    [81.01, 81, 0, false],
  ]);
  assert.deepEqual([audit.totalChecked, audit.mismatchCount, audit.totalDelta], [4, 1, 0]);
});

test('invoice for #1002 calculates the billed total from the sale lines', () => {
  const order = { items: [rice(510, { qty: 2 })], coupon: 'SAVE10' };
  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.total, 963.90);
  assert.equal(figures.tax, 45.90);
});
