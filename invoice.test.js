const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('./lib/invoice');
const pricing = require('./lib/pricing');
const reports = require('./lib/reports');

function billedOrder(items, coupon = '') {
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  return { id: 101, date: '17/11/2021', items, coupon, subtotal, discount, tax, total };
}

const mixedSlabItems = [
  { id: 1, name: 'Rice', hsn: '1006', price: 500, qty: 2 },
  { id: 2, name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
];

test('printed invoice agrees with the recorded mixed-slab SAVE10 checkout', () => {
  const order = billedOrder(mixedSlabItems, 'SAVE10');
  const html = invoice.render(order);
  const printedTotal = html.match(/Invoice Total<\/td><td class="r">₹([^<]+)/)[1];
  const printedTax = html.match(/Total GST\)<\/td><td class="r">₹([^<]+)/)[1];
  const printedDiscount = html.match(/Coupon Discount \(SAVE10\)<\/td><td[^>]*>-₹([^<]+)/)[1];
  assert.equal(printedTotal, order.total.toFixed(2));
  assert.equal(printedTax, order.tax.toFixed(2));
  assert.equal(printedDiscount, order.discount.toFixed(2));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('printed invoice preserves historical billed amounts when line GST cannot be reconstructed', () => {
  const order = {
    id: 103,
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 18,
    total: 118
  };
  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹118\.00/);
  assert.match(html, /Total GST\)<\/td><td class="r">₹18\.00/);
  assert.match(html, /Original line GST breakdown unavailable/);
  assert.doesNotMatch(html, /<td class="r">5%<\/td>/);
  const report = reports.getGstReconciliation({ orders: [order] });
  assert.equal(report.mismatchCount, 1);
  assert.equal(report.totalDelta, 13);
});

test('checkout caps SAVE10, prorates the discount, and taxes each discounted line', () => {
  const { lines, ...totals } = pricing.computeTotals(mixedSlabItems, 'SAVE10');
  assert.deepEqual(totals, {
    subtotal: 2000, discount: 150, taxable: 1850,
    tax: 157.25, cgst: 78.63, sgst: 78.62, total: 2007.25
  });
  assert.deepEqual(lines.map(({ discount, taxable, gstPercent, tax }) => (
    { discount, taxable, gstPercent, tax }
  )), [
    { discount: 75, taxable: 925, gstPercent: 5, tax: 46.25 },
    { discount: 75, taxable: 925, gstPercent: 12, tax: 111 }
  ]);
});

test('invoice uses HSN rates and taxes lines after applying capped SAVE10', () => {
  const order = billedOrder(mixedSlabItems, 'SAVE10');
  const { rows, ...figures } = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures, {
    subtotal: 2000, discount: 150, tax: 157.25, cgst: 78.63, sgst: 78.62, total: 2007.25
  });
  assert.deepEqual(rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })), [
    { gstPercent: 5, lineTax: 46.25 },
    { gstPercent: 12, lineTax: 111 }
  ]);
});

test('invoice and checkout agree for an undiscounted line using the default GST rate', () => {
  const order = billedOrder([{ name: 'Unclassified item', price: 100, qty: 1 }]);
  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(order.total, 118);
  assert.equal(figures.total, 118);
  assert.equal(figures.tax, 18);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice supports percentage, decimal, and zero stored GST rates', () => {
  const items = [12, 0.05, 0].map(gstRate => ({ price: 100, qty: 1, gstRate }));
  const bill = pricing.computeTotals(items);
  const printed = invoice.computeInvoiceFigures({ items });
  assert.deepEqual(bill.lines.map(line => line.tax), [12, 5, 0]);
  assert.deepEqual(printed.rows.map(row => row.lineTax), [12, 5, 0]);
  assert.deepEqual(printed.rows.map(row => row.gstPercent), [12, 5, 0]);
});

test('invoice sums rounded line GST before splitting CGST and SGST', () => {
  const items = [{ price: 0.03, qty: 1 }, { price: 0.03, qty: 1 }];
  const printed = invoice.computeInvoiceFigures({ items });
  assert.deepEqual(printed.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.equal(printed.tax, 0.02);
  assert.equal(printed.cgst, 0.01);
  assert.equal(printed.sgst, 0.01);
  assert.equal(pricing.computeTotals(items).tax, 0.02);
});

test('invoice skips inactive coupons and coupons below their minimum', () => {
  const items = [{ price: 100, qty: 1 }];
  assert.equal(pricing.computeTotals(items, 'DIWALI20').discount, 0);
  assert.equal(invoice.computeInvoiceFigures({ items, coupon: 'DIWALI20' }).discount, 0);
  assert.equal(pricing.computeTotals(items, 'FLAT50').discount, 0);
  assert.equal(invoice.computeInvoiceFigures({ items, coupon: 'FLAT50' }).discount, 0);
});

test('reconciliation matches the invoiced GST for SAVE10 and skips cancelled orders', () => {
  const order = billedOrder([{ name: 'Unclassified item', price: 1000, qty: 1 }], 'SAVE10');
  const cancelled = { ...billedOrder(mixedSlabItems, 'SAVE10'), id: 102, status: 'cancelled' };
  const report = reports.getGstReconciliation({ orders: [order, cancelled] });
  assert.equal(report.totalChecked, 1);
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.totalDelta, 0);
  const [row] = report.rows;
  assert.equal(row.orderId, 101);
  assert.equal(row.ledgerTax, 162);
  assert.equal(row.invoiceTax, 162);
  assert.equal(row.ledgerTotal, 1062);
  assert.equal(row.invoiceTotal, 1062);
  assert.equal(row.delta, 0);
  assert.equal(row.matched, true);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
