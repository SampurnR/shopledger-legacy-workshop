const assert = require('node:assert/strict');
const { test } = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function mixedSlabOrder() {
  // Match the line shape saved by checkout, which includes HSN but omits gstRate.
  const items = [
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ];
  const coupon = 'SAVE10';
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  return { id: 1100, status: 'completed', items, coupon, subtotal, discount, tax, total };
}

test('checkout applies the capped discount before GST at each HSN rate', () => {
  const { items, coupon } = mixedSlabOrder();
  const { lines, ...totals } = pricing.computeTotals(items, coupon);

  assert.deepEqual(totals, {
    subtotal: 2000, discount: 150, taxable: 1850, tax: 157.25,
    cgst: 78.63, sgst: 78.62, total: 2007.25
  });
  assert.deepEqual(lines.map(({ gstPercent, discount, taxable, tax }) => (
    { gstPercent, discount, taxable, tax }
  )), [
    { gstPercent: 5, discount: 75, taxable: 925, tax: 46.25 },
    { gstPercent: 12, discount: 75, taxable: 925, tax: 111 }
  ]);
});

test('invoice shows the billed total and GST breakdown for a mixed-slab order', () => {
  const order = mixedSlabOrder();
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.total, order.total);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.discount, order.discount);
  assert.deepEqual([figures.cgst, figures.sgst], [78.63, 78.62]);
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [
    [5, 46.25], [12, 111]
  ]);
  assert.match(invoice.render(order), /Invoice Total<\/td><td class="r">₹2007\.25/);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('reconciliation matches the invoice for the mixed-slab order', () => {
  const report = reports.getGstReconciliation({ orders: [mixedSlabOrder()] });

  assert.equal(report.mismatchCount, 0);
  assert.equal(report.rows[0].matched, true);
});

test('invoice accepts explicit percentage, decimal and zero GST rates like checkout', () => {
  const order = { items: [
    { price: 100, qty: 1, gstRate: 5 },
    { price: 100, qty: 1, gstRate: 0.05 },
    { price: 100, qty: 1, gstRate: 0 }
  ] };
  const { rows, tax } = invoice.computeInvoiceFigures(order);

  assert.deepEqual(rows.map(row => row.lineTax), [5, 5, 0]);
  assert.equal(tax, 10);
});

test('printed invoice shows checkout line and total GST', () => {
  const html = invoice.render(mixedSlabOrder());

  assert.match(html, /<td class="r">5%<\/td><td class="r">₹46\.25<\/td>/);
  assert.match(html, /<td class="r">12%<\/td><td class="r">₹111\.00<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25/);
});

test('CURRENT BEHAVIOUR: reconciliation flags a tax-only mismatch while the invoice shows no notice', () => {
  const order = { id: 1101, items: [{ price: 100, qty: 1 }], subtotal: 100,
    discount: 0, tax: 17.99, total: 118 };
  const report = reports.getGstReconciliation({ orders: [order] });

  assert.equal(report.mismatchCount, 1);
  assert.equal(report.totalDelta, 0);
  assert.equal(report.rows[0].matched, false);
  assert.equal(report.rows[0].invoiceTax, 18);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
