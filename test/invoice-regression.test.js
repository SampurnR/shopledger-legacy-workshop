const { test } = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

test('invoice matches billed order total, HSN GST, and post-discount tax breakdown', () => {
  const items = [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 640, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });

  assert.deepEqual({ subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax,
    cgst: printed.cgst, sgst: printed.sgst, total: printed.total }, {
    subtotal: 640, discount: 64, tax: 28.8, cgst: 14.4, sgst: 14.4, total: 604.8
  });
  assert.deepEqual({ subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax,
    cgst: printed.cgst, sgst: printed.sgst, total: printed.total }, {
    subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax,
    cgst: billed.cgst, sgst: billed.sgst, total: billed.total
  });
});
