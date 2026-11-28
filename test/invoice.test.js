const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function billedOrder(items, coupon = '') {
  const db = { nextOrderId: 1001, orders: [] };
  return orders.add(db, {
    ...pricing.computeTotals(items, coupon),
    date: '12/11/2021',
    items,
    coupon
  });
}

test('checkout apportions a capped coupon before calculating GST by HSN', () => {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ];
  const { lines, ...totals } = pricing.computeTotals(items, 'SAVE10');

  assert.deepEqual(totals, {
    subtotal: 2000, discount: 150, taxable: 1850,
    tax: 157.25, cgst: 78.63, sgst: 78.62, total: 2007.25
  });
  assert.deepEqual(lines.map(({ discount, taxable, gstPercent, tax }) => ({
    discount, taxable, gstPercent, tax
  })), [
    { discount: 75, taxable: 925, gstPercent: 5, tax: 46.25 },
    { discount: 75, taxable: 925, gstPercent: 12, tax: 111 }
  ]);
});

test('invoice matches the ledger for an explicit whole-percent GST rate without a coupon', () => {
  const order = billedOrder([{ name: 'Rice', price: 100, qty: 2, gstRate: 5 }]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.total, 210);
  assert.equal(figures.total, 210);
  assert.equal(figures.tax, 10);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice resolves GST from HSN when the order line has no explicit rate', () => {
  const order = billedOrder([{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 5);
  assert.equal(order.total, 105);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.cgst, 2.5);
  assert.equal(figures.sgst, 2.5);
  assert.equal(figures.total, 105);
});

test('invoice applies the capped percentage discount before calculating GST', () => {
  const order = billedOrder([{ name: 'Tea', hsn: '0902', price: 2000, qty: 1 }], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 333);
  assert.equal(figures.total, 2183);
});

test('invoice GST sums rounded line taxes and splits the resulting total', () => {
  const order = billedOrder([
    { name: 'Small line A', price: 0.03, qty: 1 },
    { name: 'Small line B', price: 0.03, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures.rows.map((row) => row.lineTax), [0.01, 0.01]);
  assert.equal(figures.tax, 0.02);
  assert.equal(figures.cgst, 0.01);
  assert.equal(figures.sgst, 0.01);
  assert.equal(figures.total, 0.08);
});

test('reconciliation counts tax-only mismatches and excludes cancelled orders', () => {
  const billed = billedOrder([{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]);
  const mismatched = { ...billed, id: 1002, tax: 18, total: 118 };
  const report = reports.getGstReconciliation({
    orders: [
      billed,
      mismatched,
      { ...billed, id: 1003, tax: 18 },
      { ...mismatched, id: 1004, status: 'cancelled' }
    ]
  });

  assert.equal(report.totalChecked, 3);
  assert.equal(report.mismatchCount, 2);
  assert.equal(report.totalDelta, 13);
  assert.deepEqual(report.rows.map(({ orderId, ledgerTax, invoiceTax, delta, matched }) => ({
    orderId, ledgerTax, invoiceTax, delta, matched
  })), [
    { orderId: 1001, ledgerTax: 5, invoiceTax: 5, delta: 0, matched: true },
    { orderId: 1002, ledgerTax: 18, invoiceTax: 5, delta: -13, matched: false },
    { orderId: 1003, ledgerTax: 18, invoiceTax: 5, delta: 0, matched: false }
  ]);
  assert.match(invoice.render(mismatched), /Invoice computed total \(₹105\.00\) differs from Order Ledger recorded total \(₹118\.00\) by -₹13\.00/);
});

test('printed invoice matches checkout for mixed GST rates and a capped coupon', () => {
  const order = billedOrder([
    { name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 500, qty: 2 }
  ], 'SAVE10');

  const html = invoice.render(order);
  const printedTotal = html.match(/Invoice Total<\/td><td class="r">₹([\d.]+)/)[1];
  assert.equal(printedTotal, '2007.25');
  assert.match(html, /Total GST\)<\/td><td class="r">₹157\.25/);
  assert.match(html, />5%<\/td><td class="r">₹46\.25/);
  assert.match(html, />12%<\/td><td class="r">₹111\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('reprinting preserves the billed discount after the coupon expires', () => {
  const order = {
    coupon: 'DIWALI20',
    items: [{ name: 'Rice', hsn: '1006', price: 1000, qty: 1 }],
    subtotal: 1000,
    discount: 200,
    tax: 40,
    total: 840
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.discount, 200);
  assert.equal(figures.rows[0].lineTax, 40);
  assert.equal(figures.tax, 40);
  assert.equal(figures.total, 840);
});
