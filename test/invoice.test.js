const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function billedOrder(items, coupon = '') {
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  return { id: 1001, items, coupon, subtotal, discount, tax, total };
}

const wholesaleItems = [
  { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 10 },
  { id: 2, name: 'Ghee', hsn: '0405', price: 500, qty: 2 }
];

test('checkout apportions the capped coupon before applying each HSN slab', () => {
  const { lines, ...totals } = pricing.computeTotals(wholesaleItems, 'SAVE10');

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

test('invoice prints the billed total and discounted GST for a mixed-HSN order', () => {
  const order = billedOrder(wholesaleItems, 'SAVE10');
  const { rows, ...figures } = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures, {
    subtotal: 2000, discount: 150, tax: 157.25, cgst: 78.63, sgst: 78.62, total: 2007.25
  });
  assert.deepEqual(rows.map(({ hsn, gstPercent, lineTax }) => ({ hsn, gstPercent, lineTax })), [
    { hsn: '1006', gstPercent: 5, lineTax: 46.25 },
    { hsn: '0405', gstPercent: 12, lineTax: 111 }
  ]);

  const html = invoice.render(order);
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹157.25'));
  assert.ok(html.includes('Invoice Total</td><td class="r">₹2007.25'));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 0);
});

test('invoice handles percentage, fractional, and zero GST overrides as checkout does', () => {
  const items = [5, 0.05, 0].map((gstRate) => ({ price: 1000, qty: 1, gstRate }));
  const checkout = pricing.computeTotals(items);
  const printed = invoice.computeInvoiceFigures(billedOrder(items));

  assert.deepEqual(checkout.lines.map((line) => line.tax), [50, 50, 0]);
  assert.deepEqual(printed.rows.map((row) => row.lineTax), [50, 50, 0]);
  assert.equal(printed.tax, 100);
});

test('invoice and checkout both calculate zero discount for an inactive coupon', () => {
  const order = billedOrder([{ price: 1000, qty: 1 }], 'DIWALI20');
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 0);
  assert.equal(order.total, 1180);
  assert.equal(printed.discount, 0);
  assert.equal(printed.total, 1180);
});

test('invoice GST total sums the rounded line amounts used at checkout', () => {
  const items = [{ price: 0.03, qty: 1 }, { price: 0.03, qty: 1 }];
  const order = billedOrder(items);
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 0.02);
  assert.deepEqual(printed.rows.map((row) => row.lineTax), [0.01, 0.01]);
  assert.equal(printed.tax, 0.02);
});

test('CURRENT BEHAVIOUR: reconciliation flags a GST-only difference without a printable warning', () => {
  const order = { ...billedOrder([{ price: 100, qty: 1 }]), tax: 17 };
  const cancelled = { ...billedOrder(wholesaleItems, 'SAVE10'), id: 1002, status: 'cancelled' };
  const result = reports.getGstReconciliation({ orders: [order, cancelled] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalDelta, 0);
  const [row] = result.rows;
  assert.equal(row.orderId, order.id);
  assert.equal(row.ledgerTax, 17);
  assert.equal(row.invoiceTax, 18);
  assert.equal(row.delta, 0);
  assert.equal(row.matched, false);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
