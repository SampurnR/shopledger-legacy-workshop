'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('invoice totals and line GST match the HSN rates used for billing', function () {
  const items = [
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 2 },
    { id: 2, name: 'Tea', sku: 'TEA', hsn: '0902', price: 100, qty: 1 }
  ];

  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(
    { subtotal: billed.subtotal, tax: billed.tax, total: billed.total },
    { subtotal: 300, tax: 28, total: 328 }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, tax: printed.tax, total: printed.total, cgst: printed.cgst, sgst: printed.sgst },
    { subtotal: 300, tax: 28, total: 328, cgst: 14, sgst: 14 }
  );
  assert.deepEqual(printed.rows.map(function (row) { return [row.gstPercent, row.lineTax]; }), [[5, 10], [18, 18]]);
  const html = invoice.render({ id: 7002, items: items, coupon: '' });
  assert.match(html, /<td>CGST<\/td><td class="r">₹14\.00<\/td>/);
  assert.match(html, /<td>SGST<\/td><td class="r">₹14\.00<\/td>/);
});

test('invoice discount, GST and total match the billed coupon calculation', function () {
  const items = [
    { id: 1, name: 'Rice bulk bag', sku: 'RICE-BULK', hsn: '1006', price: 2000, qty: 1 }
  ];

  const billed = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 2000, discount: 150, tax: 92.5, total: 1942.5 }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, total: printed.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total }
  );
});

test('GST reconciliation matches an invoice to its billed order figures', function () {
  const order = {
    id: 7001,
    date: '22/11/2026',
    customer: 'In-memory customer',
    status: 'completed',
    items: [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 2000, qty: 1 }],
    coupon: 'SAVE10',
    subtotal: 2000,
    discount: 150,
    tax: 92.5,
    total: 1942.5
  };

  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].invoiceDiscount, order.discount);
  assert.equal(result.rows[0].invoiceTax, order.tax);
  assert.equal(result.rows[0].invoiceTotal, order.total);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});
