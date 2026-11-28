const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function billedOrder(items, coupon = '') {
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  return { id: 42, items, coupon, subtotal, discount, tax, total };
}

test('invoice shows the billed GST and total for a discounted mixed-rate order', () => {
  const rice = { name: 'Rice', hsn: '1006', price: 650, qty: 1 };
  const ghee = { name: 'Ghee', hsn: '0405', price: 350, qty: 1 };
  const order = billedOrder([rice, ghee], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.tax, 67.05);
  assert.equal(figures.discount, 100);
  assert.equal(figures.total, 967.05);
  assert.deepEqual(figures.rows.map((row) => row.lineTax), [29.25, 37.8]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice agrees with checkout for an 18% item without a coupon', () => {
  const tea = { name: 'Tea', sku: 'TEA-1', hsn: '0902', price: 100, qty: 2 };
  const order = billedOrder([tea]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, 200);
  assert.equal(figures.discount, 0);
  assert.equal(figures.tax, 36);
  assert.equal(figures.cgst, 18);
  assert.equal(figures.sgst, 18);
  assert.equal(figures.total, 236);
  assert.equal(figures.total, order.total);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice applies the 5% and 12% HSN rates without a coupon', () => {
  const rice = { name: 'Rice', hsn: '1006', price: 100, qty: 1 };
  const ghee = { name: 'Ghee', hsn: '0405', price: 100, qty: 1 };
  const order = billedOrder([rice, ghee]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 17);
  assert.equal(order.total, 217);
  assert.deepEqual(figures.rows.map((row) => row.gstPercent), [5, 12]);
  assert.deepEqual(figures.rows.map((row) => row.lineTax), [5, 12]);
  assert.equal(figures.tax, 17);
  assert.equal(figures.total, 217);
});

test('invoice applies SAVE10 before calculating GST', () => {
  const tea = { name: 'Tea', hsn: '0902', price: 1000, qty: 1 };
  const order = billedOrder([tea], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 100);
  assert.equal(order.tax, 162);
  assert.equal(figures.discount, 100);
  assert.equal(figures.tax, 162);
  assert.equal(figures.total, 1062);
});

test('invoice honors the SAVE10 discount cap', () => {
  const tea = { name: 'Tea', hsn: '0902', price: 2240, qty: 1 };
  const order = billedOrder([tea], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 150);
  assert.equal(order.total, 2466.20);
  assert.equal(figures.discount, 150);
  assert.equal(figures.total, 2466.20);
});

test('GST audit reconciles both tax and grand total for a discounted order', () => {
  const tea = { name: 'Tea', hsn: '0902', price: 1000, qty: 1 };
  const order = billedOrder([tea], 'SAVE10');
  const report = reports.getGstReconciliation({ orders: [order] });

  assert.equal(report.totalChecked, 1);
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.rows[0].matched, true);
  assert.equal(report.rows[0].invoiceTax, 162);
  assert.equal(report.rows[0].ledgerTax, 162);
  assert.equal(report.rows[0].delta, 0);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
