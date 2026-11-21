const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');

function order(items, coupon = '') {
  return { items, coupon, total: 0 };
}

const rice = { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 640, qty: 1 };
const oil = { id: 4, sku: 'OIL-001', name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 };
const ghee = { id: 6, sku: 'DRY-001', name: 'Ghee', hsn: '0405', price: 450, qty: 2 };
const tea = { id: 8, sku: 'BEV-001', name: 'Tea', hsn: '0902', price: 140, qty: 2 };
const dal = { id: 2, sku: 'GRN-002', name: 'Dal', hsn: '0713', price: 165, qty: 2 };

test('CURRENT BEHAVIOUR: invoice uses each line item HSN GST slab', () => {
  const result = invoice.computeInvoiceFigures(order([tea, dal]));

  assert.deepEqual(result.rows.map((row) => row.gstPercent), [18, 5]);
  assert.equal(result.tax, 66.90);
  assert.equal(result.total, 676.90);
});

test('CURRENT BEHAVIOUR: SAVE10 is capped and applied before tax', () => {
  const result = invoice.computeInvoiceFigures(order([ghee, oil], 'SAVE10'));

  assert.equal(result.subtotal, 1280);
  assert.equal(result.discount, 128);
  assert.equal(result.tax, 114.30);
  assert.equal(result.total, 1266.30);
});

test('CURRENT BEHAVIOUR: capped SAVE10 on a wholesale order stays capped', () => {
  const result = invoice.computeInvoiceFigures(order([
    { id: 5, sku: 'OIL-002', name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 }
  ], 'SAVE10'));

  assert.equal(result.discount, 150);
  assert.equal(result.tax, 104.50);
  assert.equal(result.total, 2194.50);
});

test('invoice figures agree with checkout for mixed HSN slabs and a coupon', () => {
  const result = invoice.computeInvoiceFigures(order([rice, oil], 'SAVE10'));

  assert.equal(result.discount, 102);
  assert.equal(result.tax, 45.90);
  assert.equal(result.total, 963.90);
});

