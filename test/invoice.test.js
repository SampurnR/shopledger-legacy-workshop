'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function item(name, hsn, price, qty, gstRate = null) {
  return { name, sku: name, hsn, price, qty, gstRate };
}

function figures(id, coupon, items) {
  const order = { id, coupon, items };
  return {
    invoice: invoice.computeInvoiceFigures(order),
    checkout: pricing.computeTotals(items, coupon)
  };
}

test('INVOICE MATCHES CHECKOUT: #1001 mixed 5% and 12% GST slabs', () => {
  const { invoice: actual, checkout } = figures(1001, '', [
    item('Rice', '1006', 100, 1),
    item('Ghee', '0405', 100, 1)
  ]);

  assert.deepEqual(
    { subtotal: actual.subtotal, discount: actual.discount, tax: actual.tax, cgst: actual.cgst, sgst: actual.sgst, total: actual.total },
    { subtotal: 200, discount: 0, tax: 17, cgst: 8.5, sgst: 8.5, total: 217 }
  );
  assert.deepEqual(actual.rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })), [
    { gstPercent: 5, lineTax: 5 },
    { gstPercent: 12, lineTax: 12 }
  ]);
  assert.deepEqual(
    { tax: checkout.tax, cgst: checkout.cgst, sgst: checkout.sgst, total: checkout.total },
    { tax: 17, cgst: 8.5, sgst: 8.5, total: 217 }
  );
});

test('INVOICE MATCHES CHECKOUT: #1002 SAVE10 discount is applied before HSN GST', () => {
  const { invoice: actual, checkout } = figures(1002, 'SAVE10', [
    item('Rice', '1006', 640, 1),
    item('Sunflower oil', '1512', 190, 2)
  ]);

  assert.deepEqual(
    { subtotal: actual.subtotal, discount: actual.discount, tax: actual.tax, cgst: actual.cgst, sgst: actual.sgst, total: actual.total },
    { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 }
  );
  assert.deepEqual(actual.rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })), [
    { gstPercent: 5, lineTax: 28.8 },
    { gstPercent: 5, lineTax: 17.1 }
  ]);
  assert.deepEqual(
    { discount: checkout.discount, tax: checkout.tax, total: checkout.total },
    { discount: 102, tax: 45.9, total: 963.9 }
  );
});

test('INVOICE MATCHES CHECKOUT: #1004 SAVE10 applies its ₹150 cap before HSN GST', () => {
  const { invoice: actual, checkout } = figures(1004, 'SAVE10', [
    item('Groundnut oil', '1508', 1120, 2)
  ]);

  assert.deepEqual(
    { subtotal: actual.subtotal, discount: actual.discount, tax: actual.tax, cgst: actual.cgst, sgst: actual.sgst, total: actual.total },
    { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 }
  );
  assert.deepEqual(actual.rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })), [
    { gstPercent: 5, lineTax: 104.5 }
  ]);
  assert.deepEqual(
    { discount: checkout.discount, tax: checkout.tax, total: checkout.total },
    { discount: 150, tax: 104.5, total: 2194.5 }
  );
});

test('CURRENT BEHAVIOUR: #1008 all-18% items without a coupon match checkout totals', () => {
  const { invoice: actual, checkout } = figures(1008, '', [
    item('Packaged tea', '0902', 140, 1),
    item('Coffee', '0901', 310, 1)
  ]);

  assert.deepEqual(
    { subtotal: actual.subtotal, discount: actual.discount, tax: actual.tax, cgst: actual.cgst, sgst: actual.sgst, total: actual.total },
    { subtotal: 450, discount: 0, tax: 81, cgst: 40.5, sgst: 40.5, total: 531 }
  );
  assert.deepEqual(
    { subtotal: checkout.subtotal, discount: checkout.discount, tax: checkout.tax, cgst: checkout.cgst, sgst: checkout.sgst, total: checkout.total },
    { subtotal: 450, discount: 0, tax: 81, cgst: 40.5, sgst: 40.5, total: 531 }
  );
});

test('INVOICE MATCHES CHECKOUT: HSN GST and capped SAVE10 discount on #1004', () => {
  const { invoice: actual, checkout } = figures(1004, 'SAVE10', [
    item('Groundnut oil', '1508', 1120, 2)
  ]);

  assert.deepEqual(
    { subtotal: actual.subtotal, discount: actual.discount, tax: actual.tax, cgst: actual.cgst, sgst: actual.sgst, total: actual.total },
    { subtotal: checkout.subtotal, discount: checkout.discount, tax: checkout.tax, cgst: checkout.cgst, sgst: checkout.sgst, total: checkout.total }
  );
  assert.deepEqual(actual.rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })), [
    { gstPercent: 5, lineTax: 104.5 }
  ]);
});
