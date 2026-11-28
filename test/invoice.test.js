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

test('CURRENT BEHAVIOUR: invoice discounts the tax-inclusive amount and ignores HSN', () => {
  const figures = invoice.computeInvoiceFigures(discountedOrder);
  assert.equal(figures.subtotal, 1020);
  assert.equal(figures.discount, 120.36);
  assert.equal(figures.tax, 183.60);
  assert.equal(figures.total, 1083.24);
  assert.match(invoice.render(discountedOrder), /Accountant Reconciliation Notice/);
});

test('CURRENT BEHAVIOUR: invoice exceeds the SAVE10 discount cap', () => {
  const figures = invoice.computeInvoiceFigures(cappedOrder);
  assert.equal(figures.discount, 264.32);
  assert.equal(figures.total, 2378.88);
});

test('CURRENT BEHAVIOUR: invoice uses 18% for lower HSN slabs without a coupon', () => {
  const figures = invoice.computeInvoiceFigures(mixedSlabOrder);
  assert.deepEqual(figures.rows.map(row => row.gstPercent), [18, 18]);
  assert.equal(figures.tax, 230.40);
  assert.equal(figures.total, 1510.40);
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
