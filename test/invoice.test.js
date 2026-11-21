const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function compare(items, coupon = '') {
  const billed = pricing.computeTotals(items, coupon);
  const { subtotal, discount, tax, total } = billed;
  const order = { id: 1, items, coupon, subtotal, discount, tax, total };
  return { billed, order, printed: invoice.computeInvoiceFigures(order) };
}

function amounts({ subtotal, discount, tax, cgst, sgst, total }) {
  return { subtotal, discount, tax, cgst, sgst, total };
}

test('An unknown HSN with no coupon gives matching bills and assigns the odd paisa to CGST', () => {
  const { billed, printed, order } = compare([{ name: 'Misc', hsn: '9999', price: 1.50, qty: 1 }]);
  const expected = { subtotal: 1.50, discount: 0, tax: 0.27, cgst: 0.14, sgst: 0.13, total: 1.77 };
  assert.deepEqual(amounts(billed), expected);
  assert.deepEqual(amounts(printed), expected);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('Mixed HSN lines print their respective rates after apportioning FLAT50', () => {
  const { billed, printed, order } = compare([
    { name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 300, qty: 1 }
  ], 'FLAT50');

  assert.deepEqual(billed.lines.map(({ gstPercent, discount, taxable, tax }) =>
    ({ gstPercent, discount, taxable, tax })), [
    { gstPercent: 5, discount: 20, taxable: 180, tax: 9 },
    { gstPercent: 12, discount: 30, taxable: 270, tax: 32.40 }
  ]);
  assert.deepEqual(printed.rows.map(({ gstPercent, line, lineTax }) =>
    ({ gstPercent, line, lineTax })), [
    { gstPercent: 5, line: 200, lineTax: 9 },
    { gstPercent: 12, line: 300, lineTax: 32.40 }
  ]);
  assert.deepEqual(amounts(billed), { subtotal: 500, discount: 50, tax: 41.40, cgst: 20.70, sgst: 20.70, total: 491.40 });
  assert.deepEqual(amounts(printed), amounts(billed));

  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>₹41\.40/);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹491\.40/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('SAVE10 reconciles both the total and the GST', () => {
  const { billed, printed, order } = compare([{ name: 'Tea', hsn: '0902', price: 500, qty: 1 }], 'SAVE10');
  assert.deepEqual(amounts(billed), { subtotal: 500, discount: 50, tax: 81, cgst: 40.50, sgst: 40.50, total: 531 });
  assert.deepEqual(amounts(printed), amounts(billed));
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  const report = reports.getGstReconciliation({ orders: [order] });
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.rows[0].matched, true);
  assert.equal(report.totalDelta, 0);
});

test('The invoice caps SAVE10 before applying GST', () => {
  const { billed, printed } = compare([{ name: 'Oil', hsn: '1512', price: 224, qty: 10 }], 'SAVE10');
  assert.deepEqual(amounts(billed), { subtotal: 2240, discount: 150, tax: 104.50, cgst: 52.25, sgst: 52.25, total: 2194.50 });
  assert.deepEqual(amounts(printed), amounts(billed));
});

for (const [description, gstRate, expectedTax, expectedPercent] of [
  ['zero rate is preserved', 0, 0, 0],
  ['fractional rate prints as a percentage', 0.05, 5, 5]
]) {
  test('An explicit ' + description + ' on the invoice', () => {
    const { billed, printed } = compare([{ name: 'Rice', hsn: '1006', price: 100, qty: 1, gstRate }]);
    assert.equal(billed.tax, expectedTax);
    assert.equal(printed.tax, expectedTax);
    assert.equal(printed.rows[0].gstPercent, expectedPercent);
  });
}

test('Two half-paisa GST amounts round per line and sum to two paise', () => {
  const { billed, printed, order } = compare([
    { name: 'A', price: 0.10, qty: 1, gstRate: 5 },
    { name: 'B', price: 0.10, qty: 1, gstRate: 5 }
  ]);
  assert.deepEqual(printed.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual(amounts(billed), { subtotal: 0.20, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.22 });
  assert.deepEqual(amounts(printed), amounts(billed));
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('The printed oil invoice shows the capped discount and total charged at checkout', () => {
  const { order } = compare([{ name: 'Oil tin', hsn: '1512', price: 1120, qty: 2 }], 'SAVE10');
  const html = invoice.render(order);
  assert.equal(invoice.computeInvoiceFigures(order).total, 2194.50);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹2194\.50/);
  assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td[^>]*>-₹150\.00/);
});
