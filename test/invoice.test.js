const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');

const discountedOrder = {
  id: 1002,
  coupon: 'SAVE10',
  total: 963.90,
  items: [
    { name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 },
  ],
};

const cappedOrder = {
  coupon: 'SAVE10',
  items: [{ name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 }],
};

const mixedSlabOrder = {
  items: [
    { name: 'Ghee', hsn: '0405', price: 450, qty: 2 },
    { name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 },
  ],
};

test('invoice #1002 matches the amount billed and shows post-discount line GST', () => {
  const figures = invoice.computeInvoiceFigures(discountedOrder);
  assert.equal(figures.subtotal, 1020);
  assert.equal(figures.discount, 102);
  assert.equal(figures.total, 963.90);
  assert.equal(figures.tax, 45.90);
  assert.equal(figures.cgst, 22.95);
  assert.equal(figures.sgst, 22.95);
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 28.80], [5, 17.10]]);

  const html = invoice.render(discountedOrder);
  assert.match(html, /₹963\.90/);
  assert.match(html, /₹45\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice still warns when its total differs from the stored ledger amount', () => {
  const html = invoice.render({ ...discountedOrder, total: 964 });
  assert.match(html, /Accountant Reconciliation Notice/);
  assert.match(html, /-₹0\.10/);
});

test('invoice applies the SAVE10 cap before calculating GST', () => {
  const figures = invoice.computeInvoiceFigures(cappedOrder);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 104.50);
  assert.equal(figures.total, 2194.50);
});

test('invoice uses each HSN slab without a coupon', () => {
  const figures = invoice.computeInvoiceFigures(mixedSlabOrder);
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [[12, 108], [5, 19]]);
  assert.equal(figures.tax, 127);
  assert.equal(figures.total, 1407);
});

test('invoice matches a full-rate sale without a coupon, including a legacy line without HSN', () => {
  const figures = invoice.computeInvoiceFigures({
    items: [
      { name: 'Tea', hsn: '0902', price: 140, qty: 1 },
      { name: 'Legacy syrup', price: 180, qty: 2 },
    ],
  });
  assert.equal(figures.discount, 0);
  assert.equal(figures.tax, 90);
  assert.equal(figures.cgst, 45);
  assert.equal(figures.sgst, 45);
  assert.equal(figures.total, 590);
});
