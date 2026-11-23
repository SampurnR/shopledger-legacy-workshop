const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

const item = { name: 'Rice', sku: 'RICE', hsn: '1006', price: 1020, qty: 1 };
const checkout = { id: 1002, items: [item], coupon: 'SAVE10', subtotal: 1020, discount: 102, tax: 45.90, total: 963.90 };

test('the HTML invoice identifies the order and has a print button', () => {
  const html = invoice.render(checkout);
  assert.match(html, /INV-1002/);
  assert.match(html, /Print Invoice/);
});

test('an undiscounted line with no HSN or rate uses the default rate', () => {
  const result = invoice.computeInvoiceFigures({ items: [{ price: 100, qty: 1 }] });
  assert.equal(result.tax, 18);
  assert.equal(result.total, 118);
});

test('invoice matches checkout for the SAVE10 order and its GST line', () => {
  const result = invoice.computeInvoiceFigures(checkout);
  assert.equal(result.total, 963.90);
  assert.equal(result.tax, 45.90);
  assert.equal(result.rows[0].lineTax, 45.90);
  assert.equal(result.rows[0].gstPercent, 5);
  assert.doesNotMatch(invoice.render(checkout), /Accountant Reconciliation Notice/);
});

test('invoice applies the SAVE10 cap and the HSN rate', () => {
  const result = invoice.computeInvoiceFigures({ coupon: 'SAVE10', items: [{ ...item, price: 2240 }] });
  assert.equal(result.discount, 150);
  assert.equal(result.tax, 104.50);
  assert.equal(result.total, 2194.50);
});

test('invoice applies different HSN rates across undiscounted lines', () => {
  const result = invoice.computeInvoiceFigures({ items: [
    { ...item, price: 100 }, { ...item, price: 100, hsn: '0405' }, { ...item, price: 100, hsn: '0902' }
  ] });
  assert.deepEqual(result.rows.map(row => row.lineTax), [5, 12, 18]);
  assert.equal(result.cgst + result.sgst, result.tax);
  assert.equal(result.total, 335);
});
