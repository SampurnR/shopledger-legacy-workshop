const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');

function makeItem(sku, hsn, price, qty) {
  return { sku, name: sku, hsn, price, qty };
}

function makeOrder(id, coupon, items) {
  return { id, coupon, items };
}

const order1001 = makeOrder(1001, '', [
  makeItem('BEV-001', '0902', 140, 2),
  makeItem('GRN-002', '0713', 165, 2)
]);

const order1002 = makeOrder(1002, 'SAVE10', [
  makeItem('GRN-001', '1006', 640, 1),
  makeItem('OIL-001', '1512', 190, 2)
]);

const order1004 = makeOrder(1004, 'SAVE10', [
  makeItem('OIL-002', '1508', 1120, 2)
]);

const order1007 = makeOrder(1007, '', [
  makeItem('DRY-001', '0405', 450, 2),
  makeItem('OIL-001', '1512', 190, 2)
]);

const order1008 = makeOrder(1008, '', [
  makeItem('BEV-001', '0902', 140, 1),
  makeItem('BEV-003', '2106', 180, 2)
]);

test('Invoice applies each order 1001 line item HSN rate', () => {
  const result = invoice.computeInvoiceFigures(order1001);
  assert.equal(result.subtotal, 610);
  assert.equal(result.tax, 66.9);
  assert.equal(result.total, 676.9);
  assert.deepEqual(result.rows.map((row) => [row.gstPercent, row.lineTax]), [[18, 50.4], [5, 16.5]]);
});

test('Invoice matches checkout discount and GST for coupon order 1002', () => {
  const result = invoice.computeInvoiceFigures(order1002);
  assert.equal(result.tax, 45.9);
  assert.equal(result.discount, 102);
  assert.equal(result.total, 963.9);
  assert.deepEqual(result.rows.map((row) => [row.gstPercent, row.lineTax]), [[5, 28.8], [5, 17.1]]);
});

test('Invoice respects the SAVE10 maximum discount for order 1004', () => {
  const result = invoice.computeInvoiceFigures(order1004);
  assert.equal(result.tax, 104.5);
  assert.equal(result.discount, 150);
  assert.equal(result.total, 2194.5);
  assert.deepEqual(result.rows.map((row) => [row.gstPercent, row.lineTax]), [[5, 104.5]]);
});

test('Invoice applies mixed 12% and 5% HSN rates for order 1007', () => {
  const result = invoice.computeInvoiceFigures(order1007);
  assert.equal(result.tax, 127);
  assert.equal(result.total, 1407);
  assert.deepEqual(result.rows.map((row) => [row.gstPercent, row.lineTax]), [[12, 108], [5, 19]]);
});

test('Invoice retains 18% GST for order 1008 items', () => {
  const result = invoice.computeInvoiceFigures(order1008);
  assert.equal(result.tax, 90);
  assert.equal(result.total, 590);
});
