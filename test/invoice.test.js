const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function billOrder(items, coupon = '') {
  const db = { nextOrderId: 1, orders: [] };
  const billed = pricing.computeTotals(items, coupon);
  const order = orders.add(db, { ...billed, items, coupon, date: '2021-11-15' });
  return { db, order, billed };
}

test('invoice matches the billed total for a default-rate order without a coupon', () => {
  const { order } = billOrder([{ name: 'Tea', sku: 'TEA', price: 100, qty: 2 }]);

  assert.equal(order.total, 236);
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 200, discount: 0, tax: 36, cgst: 18, sgst: 18, total: 236,
    rows: [
      { name: 'Tea', sku: 'TEA', hsn: '-', qty: 2, price: 100, gstPercent: 18, line: 200, lineTax: 36 }
    ]
  });
  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹236\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('printed invoice matches the billed total and GST for mixed HSN rates with SAVE10', () => {
  const { db, order, billed } = billOrder([
    { name: 'Rice', hsn: '1006', price: 150, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 200, qty: 1 }
  ], 'SAVE10');

  assert.deepEqual(
    billed.lines.map(({ gstPercent, discount, taxable, tax }) => ({ gstPercent, discount, taxable, tax })),
    [
      { gstPercent: 5, discount: 30, taxable: 270, tax: 13.5 },
      { gstPercent: 12, discount: 20, taxable: 180, tax: 21.6 }
    ]
  );
  assert.deepEqual(
    { discount: order.discount, tax: order.tax, total: order.total, cgst: billed.cgst, sgst: billed.sgst },
    { discount: 50, tax: 35.1, total: 485.1, cgst: 17.55, sgst: 17.55 }
  );

  const { rows, ...figures } = invoice.computeInvoiceFigures(order);
  assert.equal(figures.total, order.total, 'invoice total should match the billed total');
  assert.equal(figures.tax, order.tax, 'invoice GST should match the billed GST');
  assert.deepEqual(figures, {
    subtotal: 500, discount: 50, tax: 35.1, cgst: 17.55, sgst: 17.55, total: 485.1
  });
  assert.deepEqual(
    rows.map(({ hsn, gstPercent, line, lineTax }) => ({ hsn, gstPercent, line, lineTax })),
    [
      { hsn: '1006', gstPercent: 5, line: 300, lineTax: 13.5 },
      { hsn: '0405', gstPercent: 12, line: 200, lineTax: 21.6 }
    ]
  );

  const html = invoice.render(order);
  assert.match(html, /5%<\/td><td class="r">₹13\.50/);
  assert.match(html, /12%<\/td><td class="r">₹21\.60/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹35\.10/);
  assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td[^>]*>-₹50\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹485\.10/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  const reconciliation = reports.getGstReconciliation(db);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  const { ledgerTax, invoiceTax, delta, matched } = reconciliation.rows[0];
  assert.deepEqual({ ledgerTax, invoiceTax, delta, matched }, {
    ledgerTax: 35.1, invoiceTax: 35.1, delta: 0, matched: true
  });
});

test('an eligible flat coupon reduces billed and invoice GST', () => {
  const { order } = billOrder([{ price: 300, qty: 1 }], 'FLAT50');
  const { discount, tax, total } = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: order.discount, tax: order.tax, total: order.total },
    { discount: 50, tax: 45, total: 295 }
  );
  assert.deepEqual({ discount, tax, total }, { discount: 50, tax: 45, total: 295 });
});

for (const sample of [
  { name: 'caps a percentage discount', coupon: 'SAVE10', price: 2000, discount: 150 },
  { name: 'enforces the flat coupon minimum', coupon: 'FLAT50', price: 10, discount: 0 },
  { name: 'ignores inactive coupons', coupon: 'DIWALI20', price: 1200, discount: 0 },
  { name: 'normalizes coupon casing', coupon: 'save10', price: 500, discount: 50 }
]) {
  test(`invoice ${sample.name} when recomputing a stored coupon`, () => {
    const { order } = billOrder([{ price: sample.price, qty: 1 }], sample.coupon);

    assert.equal(order.discount, sample.discount);
    assert.equal(invoice.computeInvoiceFigures(order).discount, sample.discount);
  });
}

test('invoice uses the billed GST for stored percentage, decimal, and zero rates', () => {
  const { order, billed } = billOrder([
    { price: 100, qty: 1, gstRate: 5 },
    { price: 100, qty: 1, gstRate: 0.12 },
    { price: 100, qty: 1, gstRate: 0 }
  ]);
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(({ tax }) => tax), [5, 12, 0]);
  assert.deepEqual(printed.rows.map(({ gstPercent }) => gstPercent), [5, 12, 0]);
  assert.deepEqual(printed.rows.map(({ lineTax }) => lineTax), [5, 12, 0]);
  assert.equal(order.total, 317);
  assert.equal(printed.total, 317);
});

test('invoice rounds GST per line like billing', () => {
  const { order } = billOrder([{ price: 0.03, qty: 1 }, { price: 0.03, qty: 1 }]);
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 0.02);
  assert.equal(order.total, 0.08);
  assert.deepEqual(printed.rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.equal(printed.tax, 0.02);
  assert.equal(printed.cgst, 0.01);
  assert.equal(printed.sgst, 0.01);
  assert.equal(printed.total, 0.08);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice warns when recomputed and historical recorded totals differ', () => {
  const { order } = billOrder([{ price: 100, qty: 1 }]);
  order.total = 120;

  assert.match(invoice.render(order), /differs from Order Ledger recorded total \(₹120\.00\) by -₹2\.00\./);
});

test('CURRENT BEHAVIOUR: the invoice warning omits a GST mismatch when totals match', () => {
  const { db, order } = billOrder([{ price: 100, qty: 1 }]);
  // Model a historical record whose total agrees with the invoice but whose stored GST differs.
  order.tax = 5;

  assert.equal(invoice.computeInvoiceFigures(order).tax, 18);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  const report = reports.getGstReconciliation(db);
  assert.equal(report.rows[0].delta, 0);
  assert.equal(report.rows[0].matched, false);
  assert.equal(report.mismatchCount, 1);
});
