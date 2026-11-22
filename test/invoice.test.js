const test = require('node:test');
const assert = require('node:assert/strict');
const { computeInvoiceFigures } = require('../lib/invoice');

test('CURRENT BEHAVIOUR: order #1002 uses 18% GST on both lines and discounts the tax-inclusive subtotal', () => {
  const order = {
    id: 1002,
    coupon: 'SAVE10',
    total: 963.90,
    items: [
      { name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { name: 'Oil', hsn: '1512', price: 190, qty: 2 }
    ]
  };

  const figures = computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(row => row.gstPercent), [18, 18]);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [115.20, 68.40]);
  assert.equal(figures.subtotal, 1020);
  assert.equal(figures.tax, 183.60);
  assert.equal(figures.discount, 120.36);
  assert.equal(figures.total, 1083.24);
});

test('CURRENT BEHAVIOUR: SAVE10 exceeds its cap on a 2,240 rupee subtotal', () => {
  const figures = computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [{ name: 'Ghee', hsn: '0405', price: 560, qty: 4 }]
  });

  assert.equal(figures.subtotal, 2240);
  assert.equal(figures.tax, 403.20);
  assert.equal(figures.discount, 264.32);
  assert.equal(figures.total, 2378.88);
});

test('CURRENT BEHAVIOUR: an 18% order without a coupon splits GST before rounding', () => {
  const figures = computeInvoiceFigures({
    coupon: '',
    items: [{ name: 'Tea', hsn: '0902', price: 10.05, qty: 1 }]
  });

  assert.equal(figures.discount, 0);
  assert.equal(figures.tax, 1.81);
  assert.equal(figures.cgst, 0.90);
  assert.equal(figures.sgst, 0.91);
  assert.equal(figures.total, 11.86);
});
