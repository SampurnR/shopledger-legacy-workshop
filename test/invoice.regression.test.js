'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

// Synthetic saved order: 700 subtotal - 70 discount + 96.30 GST.
// Expected values are independent of the implementation under test.
test('invoice total and per-line GST match the billed mixed-rate SAVE10 order', () => {
  const order = {
    id: 9002, date: '22/11/2026', customer: 'Test customer',
    paymentMode: 'cash', status: 'completed', coupon: 'SAVE10',
    subtotal: 700, discount: 70, tax: 96.3, total: 726.3,
    items: [
      { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 100, qty: 1 },
      { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 100, qty: 1 },
      { id: 3, sku: 'TEA', name: 'Tea', hsn: '0902', price: 500, qty: 1 }
    ]
  };
  const before = structuredClone(order);
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures, {
    subtotal: 700, discount: 70, tax: 96.3, cgst: 48.15, sgst: 48.15, total: 726.3,
    rows: [
      { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 1, price: 100,
        gstPercent: 5, line: 100, lineTax: 4.5 },
      { name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 1, price: 100,
        gstPercent: 12, line: 100, lineTax: 10.8 },
      { name: 'Tea', sku: 'TEA', hsn: '0902', qty: 1, price: 500,
        gstPercent: 18, line: 500, lineTax: 81 }
    ]
  });
  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">\u20b9726\.30/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">\u20b996\.30/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
  assert.deepEqual(order, before);
});
