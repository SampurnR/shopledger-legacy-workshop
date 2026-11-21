const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

function figures(result) {
  return { subtotal: result.subtotal, discount: result.discount, tax: result.tax,
    cgst: result.cgst, sgst: result.sgst, total: result.total };
}

test('order 1002 invoice matches stored order totals and 5% GST breakdown', () => {
  const order = { id: 1002, coupon: 'SAVE10', items: [
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 4, name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
  ], subtotal: 1020, discount: 102, tax: 45.90, total: 963.90 };
  const result = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures(result), { subtotal: 1020, discount: 102, tax: 45.90,
    cgst: 22.95, sgst: 22.95, total: 963.90 });
  assert.deepEqual(result.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 28.8], [5, 17.1]]);
});

test('invoice uses mixed HSN GST slabs and order-pricing line taxes', () => {
  const result = invoice.computeInvoiceFigures({ items: [
    { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { name: 'Ghee', hsn: '0405', price: 100, qty: 1 },
    { name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ] });
  assert.deepEqual(figures(result), { subtotal: 300, discount: 0, tax: 35,
    cgst: 17.5, sgst: 17.5, total: 335 });
  assert.deepEqual(result.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 5], [12, 12], [18, 18]]);
});

test('invoice applies SAVE10 cap before computing GST', () => {
  const result = invoice.computeInvoiceFigures({ coupon: 'SAVE10', items: [
    { name: 'Tea', hsn: '0902', price: 2000, qty: 1 }
  ] });
  assert.deepEqual(figures(result), { subtotal: 2000, discount: 150, tax: 333,
    cgst: 166.5, sgst: 166.5, total: 2183 });
});

test('invoice GST breakdown matches order even when grand totals already match', () => {
  const result = invoice.computeInvoiceFigures({ coupon: 'SAVE10', items: [
    { name: 'Tea', hsn: '0902', price: 1000, qty: 1 }
  ] });
  assert.deepEqual(figures(result), { subtotal: 1000, discount: 100, tax: 162,
    cgst: 81, sgst: 81, total: 1062 });
});
