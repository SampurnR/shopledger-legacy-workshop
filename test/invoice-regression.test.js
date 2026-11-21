'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

test('invoice total and GST breakdown match the billed HSN order with FLAT50', () => {
  // In-memory equivalent of the order reproduced in the temporary running app.
  const order = {
    id: 1001, date: '21/11/2026', customer: 'Walk-in', coupon: 'FLAT50',
    items: [{ id: 1, name: 'Reproduction rice', sku: 'REPRO', hsn: '1006', price: 500, qty: 1 }],
    subtotal: 500, discount: 50, tax: 22.5, total: 472.5
  };
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 500, discount: 50, tax: 22.5, cgst: 11.25, sgst: 11.25, total: 472.5,
    rows: [{ name: 'Reproduction rice', sku: 'REPRO', hsn: '1006', qty: 1,
      price: 500, gstPercent: 5, line: 500, lineTax: 22.5 }]
  });
  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹472\.50/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹22\.50/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
});
