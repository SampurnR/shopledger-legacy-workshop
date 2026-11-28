'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const tax = require('../lib/tax');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('CURRENT BEHAVIOUR: order totals use the HSN slab and apply SAVE10 before GST', () => {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];

  assert.deepEqual(pricing.computeTotals(items, 'SAVE10'), {
    subtotal: 1000, discount: 100, taxable: 900, tax: 45, cgst: 22.5, sgst: 22.5, total: 945,
    lines: [{ id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 1000, discount: 100, taxable: 900, tax: 45, net: 945 }]
  });
});

test('invoice uses the same HSN GST rate and total as the billed order', () => {
  const order = { items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }], coupon: '' };
  const billed = pricing.computeTotals(order.items, '').total;
  const invoiceFigures = invoice.computeInvoiceFigures(order);
  assert.equal(tax.getRateForItem(order.items[0]), 0.05);
  assert.equal(billed, 1050);
  assert.deepEqual({ tax: invoiceFigures.tax, total: invoiceFigures.total }, { tax: 50, total: billed });
});

test('invoice uses the same discounted taxable value, GST and total as the billed order', () => {
  const order = { items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }], coupon: 'SAVE10' };
  const billed = pricing.computeTotals(order.items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures(order);
  assert.deepEqual({ billedDiscount: billed.discount, billedTax: billed.tax, billedTotal: billed.total }, { billedDiscount: 100, billedTax: 45, billedTotal: 945 });
  assert.deepEqual({ invoiceDiscount: invoiceFigures.discount, invoiceTax: invoiceFigures.tax, invoiceTotal: invoiceFigures.total }, { invoiceDiscount: billed.discount, invoiceTax: billed.tax, invoiceTotal: billed.total });
});

test('GST reconciliation matches invoice figures to stored billed figures', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const db = { orders: [{ id: 1001, date: '28/11/2026', customer: 'Sample customer', coupon: 'SAVE10', status: 'completed', items, subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total }] };
  const reconciliation = reports.getGstReconciliation(db);
  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.deepEqual({ ledgerTax: reconciliation.rows[0].ledgerTax, ledgerTotal: reconciliation.rows[0].ledgerTotal, invoiceTax: reconciliation.rows[0].invoiceTax, invoiceTotal: reconciliation.rows[0].invoiceTotal, delta: reconciliation.rows[0].delta, matched: reconciliation.rows[0].matched }, { ledgerTax: 45, ledgerTotal: 945, invoiceTax: 45, invoiceTotal: 945, delta: 0, matched: true });
});
