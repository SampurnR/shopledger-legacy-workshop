const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function billedOrder(items, coupon = '') {
  const db = { nextOrderId: 1, orders: [] };
  return orders.add(db, {
    ...pricing.computeTotals(items, coupon),
    items,
    coupon,
    date: '2026-01-15'
  });
}

test('invoice and billing agree on default GST without a coupon', () => {
  const order = billedOrder([{ name: 'Tea', price: 100, qty: 2 }]);

  assert.equal(order.total, 236);
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 200,
    discount: 0,
    tax: 36,
    cgst: 18,
    sgst: 18,
    total: 236,
    rows: [{
      name: 'Tea', sku: '-', hsn: '-', qty: 2, price: 100,
      gstPercent: 18, line: 200, lineTax: 36
    }]
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('percentage coupon reduces taxable value even when the grand total would agree', () => {
  const order = billedOrder([{ name: 'Rice', price: 100, qty: 1, gstRate: 5 }], 'WELCOME');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.discount, order.tax, order.total], [5, 4.75, 99.75]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [5, 4.75, 99.75]);
  assert.equal(figures.rows[0].lineTax, 4.75);
});

test('invoice uses the checkout GST rules for decimal and zero rates', () => {
  const order = billedOrder([
    { name: 'Rice', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Exempt item', price: 100, qty: 1, gstRate: 0 }
  ]);

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(order.total, 205);
  assert.equal(figures.total, 205);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) =>
    [gstPercent, lineTax]), [[5, 5], [0, 0]]);
});

test('invoice uses the capped percentage discount from checkout', () => {
  const order = billedOrder([{ name: 'Tea', price: 2000, qty: 1 }], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.discount, order.tax, order.total], [150, 333, 2183]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [150, 333, 2183]);
  assert.equal(figures.rows[0].lineTax, 333);
});

test('invoice rounds GST per line like checkout', () => {
  const order = billedOrder([
    { name: 'First item', price: 0.09, qty: 1, gstRate: 5 },
    { name: 'Second item', price: 0.09, qty: 1, gstRate: 5 }
  ]);

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual([order.tax, order.total], [0, 0.18]);
  assert.deepEqual(figures.rows.map(({ lineTax }) => lineTax), [0, 0]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [0, 0, 0, 0.18]);
});

test('invoice accounts for a flat coupon before calculating GST', () => {
  const order = billedOrder([{ name: 'Tea', price: 300, qty: 1 }], 'FLAT50');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.discount, order.tax, order.total], [50, 45, 295]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [50, 45, 295]);
  assert.equal(figures.rows[0].lineTax, 45);
});

test('invoice preserves recorded amounts and falls back when amounts are absent', () => {
  const items = [{ name: 'Tea', price: 100, qty: 1 }];
  const recorded = { id: 1, items, subtotal: '100', discount: '10', tax: '0', total: '90' };
  const html = invoice.render(recorded);
  assert.match(html, /Total GST\)<\/td><td class="r">₹0\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹90\.00/);
  assert.match(html, /Accountant Reconciliation Notice/);
  assert.equal(reports.getGstReconciliation({ orders: [recorded] }).mismatchCount, 1);

  const legacy = { id: 1, items };
  const fallback = invoice.computeInvoiceFigures(legacy);
  assert.deepEqual(
    [fallback.subtotal, fallback.discount, fallback.tax, fallback.cgst, fallback.sgst, fallback.total],
    [100, 0, 18, 9, 9, 118]
  );
  assert.doesNotMatch(invoice.render(legacy), /Accountant Reconciliation Notice/);
});

test('printed invoice matches checkout for mixed GST slabs and a percentage coupon', () => {
  const order = billedOrder([
    { name: 'Rice', hsn: '1006', price: 300, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 400, qty: 1 }
  ], 'SAVE10');

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total },
    { subtotal: 1000, discount: 100, tax: 70.2, total: 970.2 }
  );
  assert.deepEqual([figures.cgst, figures.sgst], [35.1, 35.1]);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) =>
    [gstPercent, lineTax]), [[5, 27], [12, 43.2]]);

  const html = invoice.render(order);
  assert.match(html, /<td class="r">5%<\/td><td class="r">₹27\.00<\/td>/);
  assert.match(html, /<td class="r">12%<\/td><td class="r">₹43\.20<\/td>/);
  assert.match(html, /Total GST\)<\/td><td class="r">₹70\.20/);
  assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td[^>]*>-₹100\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹970\.20/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
