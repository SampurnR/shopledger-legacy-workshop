'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// Saved order item snapshots have price, qty, and HSN, but no GST rate.
// Keep gstRate explicitly null to exercise the current invoice fallback.
function item(name, hsn, price, qty) {
  return { name, sku: name, hsn, price, qty, gstRate: null };
}

function compare(order, expectedInvoice, expectedCheckout) {
  const invoiceFigures = invoice.computeInvoiceFigures(order);
  const checkoutFigures = pricing.computeTotals(order.items, order.coupon);

  assert.deepEqual(
    {
      subtotal: invoiceFigures.subtotal,
      discount: invoiceFigures.discount,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total,
      gstPercentByLine: invoiceFigures.rows.map(row => row.gstPercent)
    },
    expectedInvoice
  );
  assert.deepEqual(
    {
      subtotal: checkoutFigures.subtotal,
      discount: checkoutFigures.discount,
      tax: checkoutFigures.tax,
      cgst: checkoutFigures.cgst,
      sgst: checkoutFigures.sgst,
      total: checkoutFigures.total
    },
    expectedCheckout
  );
}

test('CURRENT BEHAVIOUR: #1001 invoice uses the 5% and 12% HSN slabs', () => {
  compare(
    {
      id: 1001,
      coupon: '',
      items: [item('Toor dal', '0713', 165, 2), item('Spice mix', '0904', 140, 2)]
    },
    {
      subtotal: 610,
      discount: 0,
      tax: 50.1,
      cgst: 25.05,
      sgst: 25.05,
      total: 660.1,
      gstPercentByLine: [5, 12]
    },
    { subtotal: 610, discount: 0, tax: 50.1, cgst: 25.05, sgst: 25.05, total: 660.1 }
  );
});

test('CURRENT BEHAVIOUR: #1002 invoice uses checkout HSN slabs and pre-tax discount', () => {
  compare(
    {
      id: 1002,
      coupon: 'SAVE10',
      items: [item('Rice', '1006', 640, 1), item('Sunflower oil', '1512', 190, 2)]
    },
    {
      subtotal: 1020,
      discount: 102,
      tax: 45.9,
      cgst: 22.95,
      sgst: 22.95,
      total: 963.9,
      gstPercentByLine: [5, 5]
    },
    { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 }
  );
});

test('CURRENT BEHAVIOUR: #1004 invoice enforces the SAVE10 ₹150 cap before tax', () => {
  compare(
    {
      id: 1004,
      coupon: 'SAVE10',
      items: [item('Packaged tea', '0902', 140, 16)]
    },
    {
      subtotal: 2240,
      discount: 150,
      tax: 376.2,
      cgst: 188.1,
      sgst: 188.1,
      total: 2466.2,
      gstPercentByLine: [18]
    },
    { subtotal: 2240, discount: 150, tax: 376.2, cgst: 188.1, sgst: 188.1, total: 2466.2 }
  );
});

test('CURRENT BEHAVIOUR: #1008 no-coupon 18% items produce matching invoice and checkout totals', () => {
  compare(
    {
      id: 1008,
      coupon: '',
      items: [item('Packaged tea', '0902', 140, 2), item('Coffee blend', '0901', 165, 2)]
    },
    {
      subtotal: 610,
      discount: 0,
      tax: 109.8,
      cgst: 54.9,
      sgst: 54.9,
      total: 719.8,
      gstPercentByLine: [18, 18]
    },
    { subtotal: 610, discount: 0, tax: 109.8, cgst: 54.9, sgst: 54.9, total: 719.8 }
  );
});

test('CORRECT BEHAVIOUR: invoice matches checkout HSN tax and capped pre-tax discount', () => {
  compare(
    {
      id: 2000,
      coupon: 'SAVE10',
      items: [item('Rice', '1006', 640, 1), item('Ghee', '0405', 800, 2)]
    },
    {
      subtotal: 2240,
      discount: 150,
      tax: 209,
      cgst: 104.5,
      sgst: 104.5,
      total: 2299,
      gstPercentByLine: [5, 12]
    },
    { subtotal: 2240, discount: 150, tax: 209, cgst: 104.5, sgst: 104.5, total: 2299 }
  );
});
