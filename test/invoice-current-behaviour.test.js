const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// Synthetic fixtures only: this suite never imports store.js or accesses a database.
function order(items, coupon = '') {
  return {
    id: 9001, date: '15/11/2026', customer: 'Test Customer',
    paymentMode: 'cash', status: 'completed', items, coupon,
    ...pricing.computeTotals(items, coupon)
  };
}
function item(hsn, price, qty = 1) {
  return { id: 1, sku: 'TEST-001', name: 'Synthetic product', hsn, price, qty };
}

test('18% items without a coupon match checkout totals', () => {
  const o = order([item('0902', 100, 2)]);
  const result = invoice.computeInvoiceFigures(o);
  assert.deepEqual([result.subtotal, result.discount, result.tax, result.total], [200, 0, 36, 236]);
  assert.equal(result.total, o.total);
  assert.equal(result.cgst + result.sgst, result.tax);
});

test('5% and 12% HSN invoice lines match checkout slabs', () => {
  const o = order([item('1006', 100), { ...item('0405', 100), id: 2 }]);
  const result = invoice.computeInvoiceFigures(o);
  assert.deepEqual(result.rows.map(row => row.gstPercent), [5, 12]);
  assert.equal(result.tax, 17);
  assert.equal(result.total, 217);
  assert.equal(o.tax, 17);
  assert.equal(o.total, 217);
});

test('SAVE10 discounts the subtotal before calculating GST', () => {
  const o = order([item('1006', 1020)], 'SAVE10');
  const result = invoice.computeInvoiceFigures(o);
  assert.deepEqual([result.discount, result.tax, result.total], [102, 45.9, 963.9]);
  assert.deepEqual([o.discount, o.tax, o.total], [102, 45.9, 963.9]);
});

test('SAVE10 respects its 150 discount cap', () => {
  const o = order([item('0902', 2240)], 'SAVE10');
  const result = invoice.computeInvoiceFigures(o);
  assert.deepEqual([result.discount, result.tax, result.total], [150, 376.2, 2466.2]);
  assert.deepEqual([o.discount, o.tax, o.total], [150, 376.2, 2466.2]);
});

test('invoice ignores SAVE10 below its minimum spend', () => {
  const o = order([item('0902', 100)], 'SAVE10');
  const result = invoice.computeInvoiceFigures(o);
  assert.equal(result.discount, 0);
  assert.equal(result.total, 118);
  assert.equal(o.discount, 0);
  assert.equal(o.total, 118);
});

test('invoice ignores the inactive DIWALI20 coupon', () => {
  const o = order([item('0902', 1000)], 'DIWALI20');
  const result = invoice.computeInvoiceFigures(o);
  assert.equal(result.discount, 0);
  assert.equal(result.total, 1180);
  assert.equal(o.discount, 0);
  assert.equal(o.total, 1180);
});

test('flat coupon reduces the taxable value before GST', () => {
  const o = order([item('0902', 500)], 'FLAT50');
  const result = invoice.computeInvoiceFigures(o);
  assert.deepEqual([result.discount, result.tax, result.total], [50, 81, 531]);
  assert.deepEqual([o.discount, o.tax, o.total], [50, 81, 531]);
});

test('printed invoice displays separate CGST and SGST amounts', () => {
  const o = order([item('0902', 100)]);
  const result = invoice.computeInvoiceFigures(o);
  const html = invoice.render(o);
  assert.deepEqual([result.cgst, result.sgst], [9, 9]);
  assert.match(html, /<td>Taxable Value<\/td>/);
  assert.match(html, /<td>CGST<\/td><td class="r">₹9\.00/);
  assert.match(html, /<td>SGST<\/td><td class="r">₹9\.00/);
  assert.match(html, /Invoice Total/);
});
