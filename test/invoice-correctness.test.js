const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

test('invoice total, GST split, and line GST match the amount billed for a discounted mixed-HSN order', () => {
  const items = [
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 200, qty: 1 },
    { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 200, qty: 1 }
  ];
  const billed = pricing.computeTotals(items, 'FLAT50');
  const order = {
    id: 1001,
    date: '01/01/2022',
    customer: 'Test customer',
    items,
    coupon: 'FLAT50',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };

  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax,
      cgst: printed.cgst, sgst: printed.sgst, total: printed.total },
    { subtotal: 400, discount: 50, tax: 29.75, cgst: 14.88,
      sgst: 14.87, total: 379.75 }
  );
  assert.deepEqual(printed.rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })), [
    { gstPercent: 5, lineTax: 8.75 },
    { gstPercent: 12, lineTax: 21 }
  ]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('historical invoice keeps the discount charged before its coupon was deactivated', () => {
  const order = {
    id: 1002,
    date: '01/01/2022',
    customer: 'Test customer',
    items: [{ id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 1000, qty: 1 }],
    coupon: 'DIWALI20', // Currently inactive in config.js.
    subtotal: 1000,
    discount: 200,
    tax: 40,
    total: 840
  };

  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    { discount: printed.discount, tax: printed.tax, cgst: printed.cgst,
      sgst: printed.sgst, total: printed.total },
    { discount: 200, tax: 40, cgst: 20, sgst: 20, total: 840 }
  );
  assert.equal(printed.rows[0].lineTax, 40);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
