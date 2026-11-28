const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

const order = {
  coupon: 'SAVE10',
  items: [{ name: 'Rice', sku: 'R1', hsn: '1006', qty: 3, price: 640 }]
};

test('CURRENT BEHAVIOUR: invoice uses default GST and uncapped coupon', () => {
  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.tax, 345.60);
  assert.equal(figures.discount, 226.56);
  assert.equal(figures.total, 2039.04);
});

test('invoice keeps product identity, quantity and gross amount', () => {
  const [row] = invoice.computeInvoiceFigures(order).rows;
  assert.deepEqual([row.name, row.sku, row.hsn, row.qty, row.price, row.line],
    ['Rice', 'R1', '1006', 3, 640, 1920]);
});
