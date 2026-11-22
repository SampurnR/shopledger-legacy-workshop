'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

function billedOrder(items, coupon) {
  const totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 1001,
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice HSN GST breakdown matches the order pricing', function () {
  const order = billedOrder([
    { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 2 }
  ]);

  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: invoiceFigures.subtotal, tax: invoiceFigures.tax, cgst: invoiceFigures.cgst, sgst: invoiceFigures.sgst, total: invoiceFigures.total },
    { subtotal: billed.subtotal, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total }
  );
  assert.equal(invoiceFigures.rows[0].gstPercent, billed.lines[0].gstPercent);
});

test('invoice coupon discount and total match the billed SAVE10 order', function () {
  const order = billedOrder([
    { id: 2, sku: 'GEN-1', name: 'General item', hsn: '', price: 2000, qty: 1 }
  ], 'SAVE10');

  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { discount: billed.discount, tax: billed.tax, total: billed.total }
  );
});

test('invoice does not reapply an inactive DIWALI20 coupon', function () {
  const order = billedOrder([
    { id: 3, sku: 'GEN-2', name: 'Small item', hsn: '', price: 100, qty: 1 }
  ], 'DIWALI20');

  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: invoiceFigures.discount, total: invoiceFigures.total },
    { discount: billed.discount, total: billed.total }
  );
});

