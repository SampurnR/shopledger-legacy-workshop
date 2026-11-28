'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

test('REGRESSION: SAVE10 rice invoice matches the billed total and post-discount GST', () => {
  const order = {
    items: [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 500, qty: 1 }],
    coupon: 'SAVE10', subtotal: 500, discount: 50, tax: 22.5, total: 472.5
  };
  // Literal expectations from the bill: (500 - 50) * 5% = 22.50 GST.
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 500, discount: 50, tax: 22.5, cgst: 11.25, sgst: 11.25, total: 472.5,
    rows: [{ name: 'Rice', sku: 'RICE', hsn: '1006', qty: 1, price: 500,
      gstPercent: 5, line: 500, lineTax: 22.5 }]
  });
  const html = invoice.render(order);
  assert.ok(html.includes('Invoice Total</td><td class="r">₹472.50</td>'));
  assert.ok(html.includes('<td class="r">5%</td><td class="r">₹22.50</td>'));
});
