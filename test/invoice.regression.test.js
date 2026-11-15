'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

// In-memory reconstruction of the ticket, never a database read.
test('REGRESSION: #1002 invoice uses 5% HSN GST after SAVE10 discount', () => {
  const order = {
    id: 1002, date: '05/01/2022', customer: 'Anil Kulkarni', coupon: 'SAVE10',
    items: [{ name: 'Rice', sku: 'RICE', hsn: '1006', price: 204, qty: 5 }],
    subtotal: 1020, discount: 102, tax: 45.9, total: 963.9
  };
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9,
    rows: [{ name: 'Rice', sku: 'RICE', hsn: '1006', qty: 5, price: 204,
      gstPercent: 5, line: 1020, lineTax: 45.9 }]
  });
  const html = invoice.render(order);
  assert.ok(html.includes('Invoice Total</td><td class="r">₹963.90'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
});
