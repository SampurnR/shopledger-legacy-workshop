const assert = require('node:assert/strict');
const test = require('node:test');
const config = require('../config');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');

function billOrder(items, coupon = '') {
  const db = { nextOrderId: 1, orders: [] };
  const totals = pricing.computeTotals(items, coupon);
  const order = orders.add(db, { ...totals, items, coupon, date: '2021-11-15' });
  return { order, totals, figures: invoice.computeInvoiceFigures(order) };
}

test('default-rate order without a coupon agrees with its printable invoice', () => {
  const { order, figures } = billOrder([{ name: 'Tea', price: 100, qty: 2 }]);

  assert.equal(order.total, 236);
  assert.deepEqual(figures, {
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

test('invoice uses the billed HSN slab for each line', () => {
  const { order, totals, figures } = billOrder([
    { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { name: 'Ghee', hsn: '0405', price: 200, qty: 1 }
  ]);

  assert.deepEqual(totals.lines.map(({ gstPercent, tax }) => [gstPercent, tax]), [[5, 5], [12, 24]]);
  assert.deepEqual([order.tax, totals.cgst, totals.sgst, order.total], [29, 14.5, 14.5, 329]);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [[5, 5], [12, 24]]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [29, 14.5, 14.5, 329]);

  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹29\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹329\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice applies the percentage coupon cap before GST', () => {
  const { order, totals, figures } = billOrder([
    { name: 'Tea', hsn: '0902', price: 1000, qty: 2 }
  ], 'SAVE10');

  assert.equal(totals.lines[0].taxable, 1850);
  assert.deepEqual([order.discount, order.tax, order.total], [150, 333, 2183]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [150, 333, 2183]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice calculates GST on the discounted line price after a flat coupon', () => {
  const { order, totals, figures } = billOrder([
    { name: 'Tea', price: 500, qty: 1 }
  ], 'FLAT50');

  assert.equal(totals.lines[0].taxable, 450);
  assert.deepEqual([order.discount, order.tax, order.total], [50, 81, 531]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [50, 81, 531]);
});

test('invoice honors legacy zero and decimal GST rates', () => {
  const { totals, figures } = billOrder([
    { name: 'Zero-rated item', price: 100, qty: 1, gstRate: 0 },
    { name: 'Decimal-rate item', price: 100, qty: 1, gstRate: 0.05 }
  ]);

  assert.deepEqual(totals.lines.map(({ gstPercent, tax }) => [gstPercent, tax]), [[0, 0], [5, 5]]);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [[0, 0], [5, 5]]);
});

test('invoice GST sums the rounded line taxes used at checkout', () => {
  const { order, totals, figures } = billOrder([
    { name: 'First item', price: 0.10, qty: 1, gstRate: 5 },
    { name: 'Second item', price: 0.10, qty: 1, gstRate: 5 }
  ]);

  assert.deepEqual(figures.rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.deepEqual([order.tax, totals.cgst, totals.sgst, order.total], [0.02, 0.01, 0.01, 0.22]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [0.02, 0.01, 0.01, 0.22]);
});

test('printable rice invoice shows the GST and total charged on the order', () => {
  const { order, figures } = billOrder([
    { name: 'Rice', hsn: '1006', price: 640, qty: 1 }
  ]);

  assert.deepEqual([order.tax, order.total], [32, 672]);
  assert.deepEqual([figures.rows[0].gstPercent, figures.tax, figures.total], [5, 32, 672]);
  const html = invoice.render(order);
  assert.match(html, /Total GST\)<\/td><td class="r">₹32\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹672\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('reprinting an order preserves its discount and GST after its coupon is deactivated', () => {
  const { order, figures } = billOrder([
    { name: 'Tea', hsn: '0902', price: 1000, qty: 2 }
  ], 'SAVE10');

  const coupon = config.coupons.SAVE10;
  const wasActive = coupon.active;
  coupon.active = false;
  try {
    assert.equal(pricing.computeTotals(order.items, order.coupon).discount, 0);
    assert.deepEqual(invoice.computeInvoiceFigures(order), figures);
    assert.match(invoice.render(order), /Invoice Total<\/td><td class="r">₹2183\.00/);
  } finally {
    coupon.active = wasActive;
  }
});

test('invoice prints the billed amounts and flags differences from recalculated GST', () => {
  const { order } = billOrder([{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]);
  const originalRate = config.tax.hsnSlabs['1006'];
  config.tax.hsnSlabs['1006'] = 12;
  try {
    const html = invoice.render(order);
    assert.match(html, /Recalculated GST %.*Recalculated GST Amt/);
    assert.match(html, /Total GST\)<\/td><td class="r">₹5\.00/);
    assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
    assert.match(html, /Invoice computed total \(₹112\.00\) differs from Order Ledger recorded total \(₹105\.00\) by \+₹7\.00/);
  } finally {
    config.tax.hsnSlabs['1006'] = originalRate;
  }
});
