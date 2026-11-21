const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function item(overrides = {}) {
  return { id: 1, name: 'Test item', sku: 'TEST-1', price: 100, qty: 1, ...overrides };
}

function billedOrder(items, coupon = '') {
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  return { id: 1, items, coupon, subtotal, discount, tax, total };
}

test('invoice agrees with the bill when both use fallback GST and no coupon', () => {
  const order = billedOrder([item()]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.total, 118);
  assert.equal(figures.total, 118);
  assert.equal(figures.tax, 18);
  assert.equal(figures.cgst, 9);
  assert.equal(figures.sgst, 9);
  assert.equal(figures.rows[0].gstPercent, 18);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice uses the billed HSN rates on a mixed-rate bill', () => {
  const items = [
    item({ name: 'Rice', hsn: '1006' }),
    item({ id: 2, name: 'Ghee', hsn: '0405' })
  ];
  const checkout = pricing.computeTotals(items, '');
  const figures = invoice.computeInvoiceFigures(billedOrder(items));

  assert.deepEqual(checkout.lines.map(({ gstPercent, tax }) => [gstPercent, tax]), [
    [5, 5],
    [12, 12]
  ]);
  assert.deepEqual([checkout.tax, checkout.cgst, checkout.sgst, checkout.total], [
    17, 8.5, 8.5, 217
  ]);
  assert.deepEqual(figures.rows.map(({ hsn, gstPercent, lineTax }) => [hsn, gstPercent, lineTax]), [
    ['1006', 5, 5],
    ['0405', 12, 12]
  ]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [
    17, 8.5, 8.5, 217
  ]);
});

test('invoice uses explicit whole-percent GST and puts the odd cent in CGST', () => {
  const figures = invoice.computeInvoiceFigures({ items: [item({ price: 101, gstRate: 5 })] });

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 5.05);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [
    5.05, 2.53, 2.52, 106.05
  ]);
});

test('invoice preserves a zero GST override', () => {
  const order = billedOrder([item({ gstRate: 0 })]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.tax, order.total], [0, 100]);
  assert.deepEqual([figures.rows[0].gstPercent, figures.tax, figures.total], [0, 0, 100]);
});

test('invoice applies the SAVE10 cap before calculating GST', () => {
  const order = billedOrder([item({ price: 2000, hsn: '0902' })], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.discount, order.tax, order.total], [150, 333, 2183]);
  assert.deepEqual([figures.discount, figures.tax, figures.cgst, figures.sgst, figures.total], [
    150, 333, 166.5, 166.5, 2183
  ]);
});

test('invoice calculates GST after the flat coupon discount', () => {
  const order = billedOrder([item({ price: 400, hsn: '0902' })], 'FLAT50');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.discount, order.tax, order.total], [50, 63, 413]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [50, 63, 413]);
});

test('printed invoice shows billed GST and total without a reconciliation warning', () => {
  const order = billedOrder([item({ name: 'Rice', price: 640, hsn: '1006' })], 'SAVE10');
  const html = invoice.render(order);

  assert.deepEqual([order.tax, order.total], [28.8, 604.8]);
  assert.match(html, /<td class="r">5%<\/td><td class="r">[^<]*28\.80<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">[^<]*28\.80<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*604\.80<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice|Line GST is unavailable/);
});

test('reconciliation matches when the invoice preserves the billed GST', () => {
  const order = billedOrder([item({ price: 1000, hsn: '0902' })], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);
  const report = reports.getGstReconciliation({ orders: [order] });

  assert.deepEqual([order.total, order.tax], [1062, 162]);
  assert.deepEqual([figures.total, figures.tax], [1062, 162]);
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.totalDelta, 0);
  assert.equal(report.rows[0].matched, true);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice reproduces the amount billed and the discounted line GST', () => {
  const order = billedOrder([item({ name: 'Rice', price: 640, hsn: '1006' })], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.total, 604.8);
  assert.deepEqual([figures.discount, figures.tax, figures.cgst, figures.sgst], [
    64, 28.8, 14.4, 14.4
  ]);
  assert.deepEqual([figures.rows[0].gstPercent, figures.rows[0].lineTax], [5, 28.8]);
});

test('historical invoice preserves stored totals when current pricing cannot reproduce line GST', () => {
  const order = {
    id: 2,
    items: [item({ hsn: '1006' })],
    coupon: 'SAVE10',
    subtotal: 100,
    discount: 10,
    tax: 4.5,
    total: 94.5
  };
  const figures = invoice.computeInvoiceFigures(order);
  const html = invoice.render(order);

  assert.deepEqual([figures.subtotal, figures.discount, figures.tax, figures.total], [
    100, 10, 4.5, 94.5
  ]);
  assert.deepEqual([figures.cgst, figures.sgst], [2.25, 2.25]);
  assert.deepEqual([figures.rows[0].gstPercent, figures.rows[0].lineTax], [null, null]);
  assert.match(html, /Line GST is unavailable for this recorded bill/);
  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*94\.50<\/td>/);
});
