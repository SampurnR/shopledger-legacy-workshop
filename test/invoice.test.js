const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');

function recordOrder(items, coupon = '') {
  const db = { nextOrderId: 1, orders: [] };
  const billed = pricing.computeTotals(items, coupon);
  const order = orders.add(db, {
    ...billed,
    items,
    coupon,
    date: '2021-11-15'
  });

  return { billed, order };
}

test('invoice matches the recorded charge for a default-rate item without a coupon', () => {
  const { order } = recordOrder([{ name: 'Miscellaneous', price: 50, qty: 2 }]);

  assert.equal(order.total, 118);
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 100,
    discount: 0,
    tax: 18,
    cgst: 9,
    sgst: 9,
    total: 118,
    rows: [{
      name: 'Miscellaneous',
      sku: '-',
      hsn: '-',
      qty: 2,
      price: 50,
      gstPercent: 18,
      line: 100,
      lineTax: 18
    }]
  });

  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹118\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('printable invoice matches the recorded checkout total and GST breakdown', () => {
  const { billed, order } = recordOrder([
    { name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ], 'SAVE10');

  assert.equal(order.total, 2007.25);
  assert.deepEqual(billed.lines.map(({ discount, taxable }) => [discount, taxable]),
    [[75, 925], [75, 925]]);

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.total, order.total, 'invoice total must match the billed total');
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 157.25);
  assert.equal(figures.cgst, 78.63);
  assert.equal(figures.sgst, 78.62);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]),
    [[5, 46.25], [12, 111]]);

  const html = invoice.render(order);
  assert.ok(html.includes('Invoice Total</td><td class="r">₹2007.25'));
  assert.ok(html.includes('CGST</td><td class="r">₹78.63'));
  assert.ok(html.includes('SGST</td><td class="r">₹78.62'));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice uses post-discount GST for a valid flat coupon', () => {
  const { order } = recordOrder([{ name: 'Tea', hsn: '0902', price: 300, qty: 1 }], 'FLAT50');

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, 50);
  assert.equal(figures.tax, 45);
  assert.equal(figures.rows[0].lineTax, 45);
  assert.equal(figures.total, 295);
});

test('invoice respects percentage, decimal, and zero GST overrides', () => {
  const { order } = recordOrder([
    { name: 'Percentage rate', price: 100, qty: 1, gstRate: 5 },
    { name: 'Decimal rate', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Zero rate', price: 100, qty: 1, gstRate: 0 }
  ]);

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]),
    [[5, 5], [5, 5], [0, 0]]);
  assert.equal(figures.tax, 10);
  assert.equal(figures.total, 310);
});

test('invoice sums the same rounded GST rows as checkout', () => {
  const { order } = recordOrder([
    { name: 'First small line', price: 0.03, qty: 1 },
    { name: 'Second small line', price: 0.03, qty: 1 }
  ]);

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.equal(figures.tax, 0.02);
  assert.equal(figures.cgst, 0.01);
  assert.equal(figures.sgst, 0.01);
  assert.equal(figures.total, 0.08);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice falls back to checkout coupon rules when recorded amounts are missing', () => {
  const items = [{ name: 'Miscellaneous', price: 100, qty: 1 }];

  assert.equal(invoice.computeInvoiceFigures({ items, coupon: 'DIWALI20' }).discount, 0);
  assert.equal(invoice.computeInvoiceFigures({ items, coupon: 'FLAT50' }).discount, 0);
  assert.equal(invoice.computeInvoiceFigures({ items, coupon: ' welcome ' }).discount, 5);
});

test('historical invoice keeps recorded amounts and flags a reconstructed line GST difference', () => {
  const order = {
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 0,
    total: 100
  };

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.rows[0].lineTax, 5);
  assert.equal(figures.discount, 0);
  assert.equal(figures.tax, 0);
  assert.equal(figures.cgst, 0);
  assert.equal(figures.sgst, 0);
  assert.equal(figures.total, 100);
  assert.match(invoice.render(order), /Recalculated line GST \(₹5\.00\) differs from recorded GST \(₹0\.00\)/);
});

test('invoice preserves the recorded charge and flags inconsistent summary amounts', () => {
  const { order } = recordOrder([{ name: 'Miscellaneous', price: 100, qty: 1 }]);
  order.total = 110;

  const html = invoice.render(order);
  assert.ok(html.includes('Invoice Total</td><td class="r">₹110.00'));
  assert.match(html, /Invoice summary amounts add up to ₹118\.00/);
});
