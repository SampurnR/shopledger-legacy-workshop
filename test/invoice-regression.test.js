'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

// Independent in-memory examples of the customer's billed amounts.
test('invoice regression: SAVE10 invoice matches billed 963.90 and GST 45.90', () => {
  const result = invoice.computeInvoiceFigures({ coupon: 'SAVE10', total: 963.9, tax: 45.9,
    items: [{ id: 1, name: 'Fixture rice', hsn: '1006', price: 510, qty: 2 }] });
  assert.equal(result.total, 963.9);
  assert.equal(result.discount, 102);
  assert.equal(result.tax, 45.9);
  assert.equal(result.cgst, 22.95);
  assert.equal(result.sgst, 22.95);
  assert.equal(result.rows[0].gstPercent, 5);
  assert.equal(result.rows[0].lineTax, 45.9);
});

test('invoice regression: capped SAVE10 invoice matches billed 2194.50', () => {
  const result = invoice.computeInvoiceFigures({ coupon: 'SAVE10', total: 2194.5, tax: 104.5,
    items: [{ id: 1, name: 'Fixture oil', hsn: '1508', price: 1120, qty: 2 }] });
  assert.equal(result.discount, 150);
  assert.equal(result.tax, 104.5);
  assert.equal(result.total, 2194.5);
});

test('invoice regression: mixed GST slabs use post-discount line tax', () => {
  const result = invoice.computeInvoiceFigures({ coupon: 'WELCOME', items: [
    { id: 1, name: 'Fixture rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Fixture ghee', hsn: '0405', price: 100, qty: 1 },
    { id: 3, name: 'Fixture tea', hsn: '0902', price: 100, qty: 1 }
  ] });
  assert.equal(result.total, 318.25);
  assert.equal(result.discount, 15);
  assert.equal(result.tax, 33.25);
  assert.deepEqual(result.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 4.75], [12, 11.4], [18, 17.1]]);
});

test('invoice regression: total GST equals rounded line taxes for small amounts', () => {
  const result = invoice.computeInvoiceFigures({ coupon: '', items: [
    { id: 1, name: 'Small A', price: 0.03, qty: 1 },
    { id: 2, name: 'Small B', price: 0.03, qty: 1 }
  ] });
  assert.equal(result.tax, 0.02);
  assert.equal(result.total, 0.08);
  assert.deepEqual(result.rows.map(row => row.lineTax), [0.01, 0.01]);
});
