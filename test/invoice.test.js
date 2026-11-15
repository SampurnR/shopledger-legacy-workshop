const assert = require('node:assert/strict');
const { test } = require('node:test');

const { computeInvoiceFigures } = require('../lib/invoice');
const { computeTotals } = require('../lib/pricing');

test('invoice uses the 5% and 12% HSN rates from checkout', () => {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 200, qty: 1 },
  ];
  const checkout = computeTotals(items, '');
  const invoice = computeInvoiceFigures({ items, coupon: '' });

  assert.deepEqual(checkout.lines.map((line) => line.gstPercent), [5, 12]);
  assert.deepEqual(invoice.rows.map((line) => line.gstPercent), [5, 12]);
  assert.equal(checkout.tax, 34);
  assert.equal(invoice.tax, 34);
  assert.equal(checkout.total, 434);
  assert.equal(invoice.total, 434);
});

test('invoice applies the SAVE10 cap before calculating GST', () => {
  const items = [{ id: 1, name: 'Tea', hsn: '0902', price: 560, qty: 4 }];
  const coupon = 'SAVE10';
  const checkout = computeTotals(items, coupon);
  const invoice = computeInvoiceFigures({ items, coupon });

  assert.equal(checkout.subtotal, 2240);
  assert.equal(checkout.discount, 150);
  assert.equal(checkout.tax, 376.2);
  assert.equal(checkout.total, 2466.2);

  assert.equal(invoice.subtotal, 2240);
  assert.equal(invoice.discount, 150);
  assert.equal(invoice.tax, 376.2);
  assert.equal(invoice.total, 2466.2);
});

test('invoice and checkout agree for an 18% HSN item without a coupon', () => {
  const items = [{ id: 1, name: 'Tea', hsn: '0902', price: 100, qty: 2 }];
  const checkout = computeTotals(items, '');
  const invoice = computeInvoiceFigures({ items, coupon: '' });

  assert.equal(checkout.tax, 36);
  assert.equal(invoice.tax, checkout.tax);
  assert.equal(invoice.cgst, 18);
  assert.equal(invoice.sgst, 18);
  assert.equal(invoice.discount, 0);
  assert.equal(invoice.total, 236);
  assert.equal(invoice.total, checkout.total);
});
