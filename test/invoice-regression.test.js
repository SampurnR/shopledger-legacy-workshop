const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

// A synthetic version of Ticket 1's SAVE10 example; no database access.
test('regression: 5% HSN invoice with SAVE10 agrees with the billed amount', () => {
  const order = {
    id: 9002, date: '15/11/2026', customer: 'Synthetic customer', coupon: 'SAVE10',
    items: [{ id: 1, name: 'Synthetic rice', sku: 'TEST-RICE', hsn: '1006', price: 1020, qty: 1 }],
    subtotal: 1020, discount: 102, tax: 45.9, total: 963.9
  };
  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.total, 963.9);
  assert.equal(figures.discount, 102);
  assert.equal(figures.tax, 45.9);
  assert.equal(figures.cgst, 22.95);
  assert.equal(figures.sgst, 22.95);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 45.9);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('regression: mixed slabs and proportional discounts retain checkout rounding without mutating inputs', () => {
  const order = {
    coupon: ' welcome ',
    items: [
      { id: 1, name: 'Rice', hsn: '1006', price: 19.99, qty: 1 },
      { id: 2, name: 'Ghee', hsn: '0405', price: 33.33, qty: 1 }
    ]
  };
  const snapshot = JSON.stringify(order);
  const result = invoice.computeInvoiceFigures(order);
  assert.deepEqual([result.subtotal, result.discount, result.taxable, result.tax, result.total],
    [53.32, 2.67, 50.65, 4.75, 55.4]);
  assert.deepEqual(result.rows.map(row => row.lineTax), [0.95, 3.8]);
  assert.deepEqual([result.cgst, result.sgst], [2.38, 2.37]);
  assert.equal(JSON.stringify(order), snapshot);
});

test('regression: unknown coupon is ignored and an unknown HSN uses the configured fallback', () => {
  const result = invoice.computeInvoiceFigures({
    coupon: 'NOT-A-COUPON', items: [{ name: 'Fallback item', hsn: 'UNKNOWN', price: 100, qty: 1 }]
  });
  assert.deepEqual([result.discount, result.tax, result.total], [0, 18, 118]);
});

test('regression: empty invoice and odd-paise GST split remain finite and balanced', () => {
  const empty = invoice.computeInvoiceFigures({ items: [] });
  assert.deepEqual([empty.subtotal, empty.discount, empty.tax, empty.total], [0, 0, 0, 0]);
  assert.deepEqual(empty.rows, []);
  const small = invoice.computeInvoiceFigures({ items: [{ name: 'Small item', hsn: '0902', price: 0.03, qty: 1 }] });
  assert.deepEqual([small.tax, small.cgst, small.sgst, small.total], [0.01, 0.01, 0, 0.04]);
});
