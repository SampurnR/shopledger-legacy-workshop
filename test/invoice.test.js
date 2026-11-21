const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function bill(items, coupon = '') {
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  const db = { nextOrderId: 1, orders: [] };
  return orders.add(db, {
    date: '21/11/2026',
    items,
    coupon,
    subtotal,
    discount,
    tax,
    total
  });
}

const mixedCart = [
  { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 600, qty: 2 },
  { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 800, qty: 1 }
];

test('invoice totals and line GST match the bill for a capped coupon and mixed HSN rates', () => {
  const order = bill(mixedCart, 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.total, order.total, 'invoice total must equal the amount billed');
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.cgst, 72.15);
  assert.equal(figures.sgst, 72.15);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [
    [5, 55.5],
    [12, 88.8]
  ]);
});

test('checkout caps SAVE10 and applies HSN rates after prorating the discount', () => {
  const figures = pricing.computeTotals(mixedCart, 'SAVE10');
  assert.equal(figures.subtotal, 2000);
  assert.equal(figures.discount, 150);
  assert.equal(figures.taxable, 1850);
  assert.deepEqual(
    figures.lines.map(({ gstPercent, discount, taxable, tax }) => ({
      gstPercent, discount, taxable, tax
    })),
    [
      { gstPercent: 5, discount: 90, taxable: 1110, tax: 55.5 },
      { gstPercent: 12, discount: 60, taxable: 740, tax: 88.8 }
    ]
  );
  assert.equal(figures.tax, 144.3);
  assert.equal(figures.cgst, 72.15);
  assert.equal(figures.sgst, 72.15);
  assert.equal(figures.total, 1994.3);
});

test('printable invoice displays billed GST and total without a ledger warning', () => {
  const html = invoice.render(bill(mixedCart, 'SAVE10'));

  assert.match(html, /5%<\/td><td class="r">₹55\.50<\/td>/);
  assert.match(html, /12%<\/td><td class="r">₹88\.80<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹144\.30/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹1994\.30/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('an explicit whole-percent GST rate produces a matching invoice without a warning', () => {
  const order = bill([{ name: 'Rice', hsn: '1006', gstRate: 5, price: 100, qty: 1 }]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
  assert.equal(figures.total, order.total);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice handles decimal and zero GST rates the same way as checkout', () => {
  const order = bill([
    { name: 'Decimal rate', gstRate: 0.05, price: 100, qty: 1 },
    { name: 'Zero rate', gstRate: 0, price: 100, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 5);
  assert.equal(order.total, 205);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [
    [5, 5],
    [0, 0]
  ]);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 205);
});

test('invoice GST sums the same rounded line amounts as checkout', () => {
  const order = bill([
    { name: 'First line', price: 0.03, qty: 1 },
    { name: 'Second line', price: 0.03, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures.rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.equal(figures.tax, 0.02);
  assert.equal(figures.cgst, 0.01);
  assert.equal(figures.sgst, 0.01);
  assert.equal(figures.total, 0.08);
  assert.equal(order.tax, 0.02);
  assert.equal(order.total, 0.08);
});

test('CURRENT BEHAVIOUR: reconciliation flags a tax-only mismatch, while the invoice warning stays hidden', () => {
  const matched = bill(mixedCart, 'SAVE10');
  const taxOnlyMismatch = { ...matched, id: 2, tax: 140 };
  const totalMismatch = { ...matched, id: 3, total: 1990 };
  const cancelled = { ...totalMismatch, id: 4, status: 'cancelled' };
  const report = reports.getGstReconciliation({
    orders: [matched, taxOnlyMismatch, totalMismatch, cancelled]
  });

  assert.equal(report.totalChecked, 3);
  assert.equal(report.mismatchCount, 2);
  assert.equal(report.totalDelta, 4.3);
  assert.deepEqual(
    report.rows.map(({ orderId, ledgerTax, invoiceTax, delta, matched }) => ({
      orderId, ledgerTax, invoiceTax, delta, matched
    })),
    [
      { orderId: 1, ledgerTax: 144.3, invoiceTax: 144.3, delta: 0, matched: true },
      { orderId: 2, ledgerTax: 140, invoiceTax: 144.3, delta: 0, matched: false },
      { orderId: 3, ledgerTax: 144.3, invoiceTax: 144.3, delta: 4.3, matched: false }
    ]
  );
  assert.doesNotMatch(invoice.render(taxOnlyMismatch), /Accountant Reconciliation Notice/);
  assert.match(invoice.render(totalMismatch), /differs from Order Ledger recorded total \(₹1990\.00\) by \+₹4\.30\./);
});
