const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function billedOrder(items, coupon = '') {
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  return { id: 101, date: '01/11/2021', items, coupon, subtotal, discount, tax, total };
}

function mixedSlabOrder() {
  return billedOrder([
    { id: 1, name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 1000, qty: 1 },
  ], 'SAVE10');
}

test('checkout caps SAVE10 and applies GST to discounted HSN lines', () => {
  const { items, coupon } = mixedSlabOrder();
  const { subtotal, discount, taxable, tax, cgst, sgst, total, lines } =
    pricing.computeTotals(items, coupon);

  assert.deepEqual({ subtotal, discount, taxable, tax, cgst, sgst, total }, {
    subtotal: 2000, discount: 150, taxable: 1850, tax: 157.25,
    cgst: 78.63, sgst: 78.62, total: 2007.25,
  });
  assert.deepEqual(lines.map(({ gstPercent, discount, taxable, tax }) =>
    ({ gstPercent, discount, taxable, tax })), [
    { gstPercent: 5, discount: 75, taxable: 925, tax: 46.25 },
    { gstPercent: 12, discount: 75, taxable: 925, tax: 111 },
  ]);
});

test('invoice uses discounted HSN line taxes and the capped checkout discount', () => {
  const order = mixedSlabOrder();
  const { subtotal, discount, tax, cgst, sgst, total, rows } =
    invoice.computeInvoiceFigures(order);

  assert.deepEqual({ subtotal, discount, tax, cgst, sgst, total }, {
    subtotal: 2000, discount: 150, tax: 157.25, cgst: 78.63, sgst: 78.62, total: 2007.25,
  });
  assert.deepEqual(rows.map(({ hsn, gstPercent, lineTax }) =>
    ({ hsn, gstPercent, lineTax })), [
    { hsn: '1006', gstPercent: 5, lineTax: 46.25 },
    { hsn: '0405', gstPercent: 12, lineTax: 111 },
  ]);
  assert.equal(order.total, 2007.25);
});

test('invoice uses the checkout interpretation of whole, fractional, and zero GST rates', () => {
  const order = billedOrder([
    { name: 'Whole percent', price: 100, qty: 1, gstRate: 5 },
    { name: 'Fractional rate', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Zero rate', price: 100, qty: 1, gstRate: 0 },
  ]);

  assert.equal(order.tax, 10);
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(row => row.gstPercent), [5, 5, 0]);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [5, 5, 0]);
  assert.equal(figures.tax, 10);
});

test('invoice adds the same rounded line taxes as checkout', () => {
  const order = billedOrder([
    { name: 'Small line A', price: 0.03, qty: 1 },
    { name: 'Small line B', price: 0.03, qty: 1 },
  ]);
  const { rows, tax, cgst, sgst, total } = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 0.02);
  assert.equal(order.total, 0.08);
  assert.deepEqual(rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual({ tax, cgst, sgst, total }, {
    tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08,
  });
});

test('printed invoice shows checkout figures and still warns when the ledger total differs', () => {
  const order = mixedSlabOrder();
  const html = invoice.render(order);

  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  const mismatchedHtml = invoice.render({ ...order, total: 2000 });
  assert.match(mismatchedHtml, /Invoice computed total \(₹2007\.25\) differs from Order Ledger recorded total \(₹2000\.00\) by \+₹7\.25/);
});

test('CURRENT BEHAVIOUR: a tax-only mismatch is reported with zero total delta and no invoice warning', () => {
  const order = {
    ...billedOrder([{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }]),
    tax: 17,
  };
  const report = reports.getGstReconciliation({ orders: [order] });

  assert.equal(report.totalChecked, 1);
  assert.equal(report.mismatchCount, 1);
  assert.equal(report.totalDelta, 0);
  assert.equal(report.rows[0].matched, false);
  assert.equal(report.rows[0].ledgerTax, 17);
  assert.equal(report.rows[0].invoiceTax, 18);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
