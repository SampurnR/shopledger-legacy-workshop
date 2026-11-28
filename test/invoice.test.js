'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

function makeOrder(items, coupon) {
  const billed = pricing.computeTotals(items, coupon || '');
  return {
    items,
    coupon: coupon || '',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
}

test('Invoice matches the billed order total and HSN GST breakdown', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];
  const order = makeOrder(items, 'SAVE10');
  const invoiced = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: invoiced.subtotal, discount: invoiced.discount, tax: invoiced.tax, cgst: invoiced.cgst, sgst: invoiced.sgst, gstPercent: invoiced.rows[0].gstPercent, lineTax: invoiced.rows[0].lineTax, total: invoiced.total },
    { subtotal: order.subtotal, discount: order.discount, tax: order.tax, cgst: 22.5, sgst: 22.5, gstPercent: 5, lineTax: 45, total: order.total }
  );
});

test('Invoice uses the HSN slab and matches a billed order without a coupon', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const invoiced = invoice.computeInvoiceFigures(makeOrder(items, ''));

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 1000, discount: 0, tax: 50, total: 1050 }
  );
  assert.deepEqual(
    { subtotal: invoiced.subtotal, discount: invoiced.discount, tax: invoiced.tax, cgst: invoiced.cgst, sgst: invoiced.sgst, gstPercent: invoiced.rows[0].gstPercent, lineTax: invoiced.rows[0].lineTax, total: invoiced.total },
    { subtotal: 1000, discount: 0, tax: 50, cgst: 25, sgst: 25, gstPercent: 5, lineTax: 50, total: 1050 }
  );
});

test('SAVE10 invoice matches the billed discount, GST, and total', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const invoiced = invoice.computeInvoiceFigures(makeOrder(items, 'SAVE10'));

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 1000, discount: 100, tax: 45, total: 945 }
  );
  assert.deepEqual(
    { subtotal: invoiced.subtotal, discount: invoiced.discount, tax: invoiced.tax, cgst: invoiced.cgst, sgst: invoiced.sgst, gstPercent: invoiced.rows[0].gstPercent, lineTax: invoiced.rows[0].lineTax, total: invoiced.total },
    { subtotal: 1000, discount: 100, tax: 45, cgst: 22.5, sgst: 22.5, gstPercent: 5, lineTax: 45, total: 945 }
  );
});

test('WELCOME invoice honors its maximum discount and matches the billed total', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 3000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'WELCOME');
  const invoiced = invoice.computeInvoiceFigures(makeOrder(items, 'WELCOME'));

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 3000, discount: 100, tax: 145, total: 3045 }
  );
  assert.deepEqual(
    { subtotal: invoiced.subtotal, discount: invoiced.discount, tax: invoiced.tax, cgst: invoiced.cgst, sgst: invoiced.sgst, gstPercent: invoiced.rows[0].gstPercent, lineTax: invoiced.rows[0].lineTax, total: invoiced.total },
    { subtotal: 3000, discount: 100, tax: 145, cgst: 72.5, sgst: 72.5, gstPercent: 5, lineTax: 145, total: 3045 }
  );
});
