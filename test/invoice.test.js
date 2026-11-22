'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function makeOrder(id, items, coupon) {
  return { id, items, coupon: coupon || '' };
}

function assertInvoice(order, expected) {
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
      gstPercents: invoiceFigures.rows.map((row) => row.gstPercent)
    },
    expected.invoice
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
    expected.checkout
  );
}

test('CURRENT BEHAVIOUR: order #1001 mixed 18% and 5% items without a coupon', () => {
  const order = makeOrder(1001, [
    { name: 'Assam CTC Masala Chai 250g', sku: 'BEV-001', hsn: '0902', gstRate: 18, price: 140, qty: 2 },
    { name: 'Unpolished Toor Dal 1kg', sku: 'GRN-002', hsn: '0713', gstRate: 5, price: 165, qty: 2 }
  ]);

  assertInvoice(order, {
    invoice: { subtotal: 610, discount: 0, tax: 66.9, cgst: 33.45, sgst: 33.45, total: 676.9, gstPercents: [18, 5] },
    checkout: { subtotal: 610, discount: 0, tax: 66.9, cgst: 33.45, sgst: 33.45, total: 676.9 }
  });
});

test('CURRENT BEHAVIOUR: order #1002 SAVE10 discount applies before tax', () => {
  const order = makeOrder(1002, [
    { name: 'Indrayani Basmati Rice 5kg', sku: 'GRN-001', hsn: '1006', gstRate: 5, price: 640, qty: 1 },
    { name: 'Cold-Pressed Sunflower Oil 1L', sku: 'OIL-001', hsn: '1512', gstRate: 5, price: 190, qty: 2 }
  ], 'SAVE10');

  assertInvoice(order, {
    invoice: { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9, gstPercents: [5, 5] },
    checkout: { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 }
  });
});

test('CURRENT BEHAVIOUR: order #1004 SAVE10 applies the ₹150 cap before tax', () => {
  const order = makeOrder(1004, [
    { name: 'Cold-Pressed Groundnut Oil 5L', sku: 'OIL-002', hsn: '1508', gstRate: 5, price: 1120, qty: 2 }
  ], 'SAVE10');

  assertInvoice(order, {
    invoice: { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5, gstPercents: [5] },
    checkout: { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 }
  });
});

test('CURRENT BEHAVIOUR: order #1008 all 18% items without a coupon', () => {
  const order = makeOrder(1008, [
    { name: 'Assam CTC Masala Chai 250g', sku: 'BEV-001', hsn: '0902', gstRate: 18, price: 140, qty: 1 },
    { name: 'Kokum Sherbet Concentrate 750ml', sku: 'BEV-003', hsn: '2106', gstRate: 18, price: 180, qty: 2 }
  ]);

  assertInvoice(order, {
    invoice: { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590, gstPercents: [18, 18] },
    checkout: { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590 }
  });
});

test('CURRENT BEHAVIOUR: invoice matches checkout for order #1004 stored HSN-only line', () => {
  const order = makeOrder(1004, [
    { name: 'Cold-Pressed Groundnut Oil 5L', sku: 'OIL-002', hsn: '1508', price: 1120, qty: 2 }
  ], 'SAVE10');

  assertInvoice(order, {
    invoice: { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5, gstPercents: [5] },
    checkout: { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 }
  });
});
