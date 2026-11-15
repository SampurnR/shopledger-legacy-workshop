const assert = require('node:assert/strict');
const test = require('node:test');
const { computeInvoiceFigures, render } = require('../lib/invoice');

test('invoice matches the ledger for a discounted order with mixed GST slabs', () => {
  const order = {
    id: 1003,
    items: [
      { name: 'Ghee', hsn: '0405', price: 260, qty: 1 },
      { name: 'Tea', hsn: '0902', price: 140, qty: 1 },
    ],
    coupon: 'FLAT50',
    subtotal: 400,
    discount: 50,
    tax: 49.35,
    total: 399.35,
  };

  const invoice = computeInvoiceFigures(order);
  assert.equal(invoice.total, order.total);
  assert.equal(invoice.tax, order.tax);
  assert.equal(invoice.discount, order.discount);
  assert.deepEqual(invoice.rows.map((row) => row.gstPercent), [12, 18]);
  assert.deepEqual(invoice.rows.map((row) => row.lineTax), [27.30, 22.05]);
  assert.doesNotMatch(render(order), /Accountant Reconciliation Notice/);
});

test('invoice applies 5% and 12% GST using the HSN for each item', () => {
  const invoice = computeInvoiceFigures({
    items: [
      { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
      { name: 'Ghee', hsn: '0405', price: 200, qty: 1 },
    ],
  });

  assert.deepEqual(invoice.rows.map((row) => row.gstPercent), [5, 12]);
  assert.deepEqual(invoice.rows.map((row) => row.lineTax), [5, 24]);
  assert.equal(invoice.tax, 29);
  assert.equal(invoice.total, 329);
});

test('invoice applies SAVE10 before GST and agrees with the order ledger', () => {
  const order = {
    id: 1002,
    items: [{ name: 'Rice', hsn: '1006', price: 1020, qty: 1 }],
    coupon: 'SAVE10',
    subtotal: 1020,
    discount: 102,
    tax: 45.90,
    total: 963.90,
  };

  const invoice = computeInvoiceFigures(order);
  assert.equal(invoice.discount, 102);
  assert.equal(invoice.tax, 45.90);
  assert.equal(invoice.total, 963.90);
  const html = render(order);
  assert.match(html, /₹963\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice caps SAVE10 at ₹150 on a ₹2,240 subtotal', () => {
  const invoice = computeInvoiceFigures({
    items: [{ name: 'Tea', hsn: '0902', price: 1120, qty: 2 }],
    coupon: 'SAVE10',
  });

  assert.equal(invoice.subtotal, 2240);
  assert.equal(invoice.discount, 150);
  assert.equal(invoice.tax, 376.20);
  assert.equal(invoice.total, 2466.20);
});

test('an 18% order without a coupon matches the ledger', () => {
  const order = {
    id: 1008,
    items: [{ name: 'Tea', hsn: '0902', price: 100, qty: 2 }],
    subtotal: 200,
    discount: 0,
    tax: 36,
    total: 236,
  };

  const invoice = computeInvoiceFigures(order);
  assert.equal(invoice.discount, 0);
  assert.equal(invoice.tax, 36);
  assert.equal(invoice.cgst, 18);
  assert.equal(invoice.sgst, 18);
  assert.equal(invoice.total, 236);
  assert.doesNotMatch(render(order), /Accountant Reconciliation Notice/);
});

test('invoice still flags a difference when the recorded ledger total disagrees', () => {
  const order = {
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    total: 110,
  };

  assert.match(render(order), /Invoice computed total \(₹105\.00\) differs from Order Ledger recorded total \(₹110\.00\)/);
});
