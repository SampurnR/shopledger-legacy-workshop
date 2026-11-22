'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function line(name, price, qty, hsn, gstRate) {
  return { name, price, qty, hsn, gstRate };
}

function checkScenario(items, coupon, expectedInvoice, expectedCheckout) {
  // Both calculations receive the same in-memory line items and coupon.
  const order = { items, coupon };
  const invoiceFigures = invoice.computeInvoiceFigures(order);
  const checkoutFigures = pricing.computeTotals(items, coupon);

  assert.deepEqual({
    subtotal: invoiceFigures.subtotal,
    discount: invoiceFigures.discount,
    tax: invoiceFigures.tax,
    cgst: invoiceFigures.cgst,
    sgst: invoiceFigures.sgst,
    total: invoiceFigures.total,
    rows: invoiceFigures.rows.map((row) => ({ gstPercent: row.gstPercent, lineTax: row.lineTax }))
  }, expectedInvoice);
  assert.deepEqual({
    subtotal: checkoutFigures.subtotal,
    discount: checkoutFigures.discount,
    tax: checkoutFigures.tax,
    cgst: checkoutFigures.cgst,
    sgst: checkoutFigures.sgst,
    total: checkoutFigures.total
  }, expectedCheckout);
}

test('CURRENT BEHAVIOUR: order #1001 style mixed 5% and 12% GST without coupon', () => {
  const items = [
    line('Ghee', 450, 1, '0405', 12),
    line('Toor Dal', 165, 1, '0713', 5)
  ];
  checkScenario(items, '', {
    subtotal: 615,
    discount: 0,
    tax: 62.25,
    cgst: 31.13,
    sgst: 31.12,
    total: 677.25,
    rows: [{ gstPercent: 12, lineTax: 54 }, { gstPercent: 5, lineTax: 8.25 }]
  }, {
    subtotal: 615,
    discount: 0,
    tax: 62.25,
    cgst: 31.13,
    sgst: 31.12,
    total: 677.25
  });
});

test('CURRENT BEHAVIOUR: order #1002 style SAVE10 on subtotal 1020', () => {
  const items = [
    line('Rice', 640, 1, '1006', 5),
    line('Sunflower Oil', 190, 2, '1512', 5)
  ];
  checkScenario(items, 'SAVE10', {
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9,
    rows: [{ gstPercent: 5, lineTax: 28.8 }, { gstPercent: 5, lineTax: 17.1 }]
  }, {
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9
  });
});

test('CURRENT BEHAVIOUR: order #1004 style SAVE10 on subtotal 2240', () => {
  const items = [line('Groundnut Oil', 1120, 2, '1508', 5)];
  checkScenario(items, 'SAVE10', {
    subtotal: 2240,
    discount: 150,
    tax: 104.5,
    cgst: 52.25,
    sgst: 52.25,
    total: 2194.5,
    rows: [{ gstPercent: 5, lineTax: 104.5 }]
  }, {
    subtotal: 2240,
    discount: 150,
    tax: 104.5,
    cgst: 52.25,
    sgst: 52.25,
    total: 2194.5
  });
});

test('CURRENT BEHAVIOUR: order #1008 style all-18% items without coupon', () => {
  const items = [
    line('Packaged Tea', 140, 2, '0902', 18),
    line('Coffee Blend', 310, 1, '0901', 18)
  ];
  checkScenario(items, '', {
    subtotal: 590,
    discount: 0,
    tax: 106.2,
    cgst: 53.1,
    sgst: 53.1,
    total: 696.2,
    rows: [{ gstPercent: 18, lineTax: 50.4 }, { gstPercent: 18, lineTax: 55.8 }]
  }, {
    subtotal: 590,
    discount: 0,
    tax: 106.2,
    cgst: 53.1,
    sgst: 53.1,
    total: 696.2
  });
});
test('invoice matches checkout HSN GST and capped pre-tax coupon discount', () => {
  // Order route line items carry HSN but do not persist gstRate.
  const items = [line('Groundnut Oil', 1120, 2, '1508', undefined)];
  const coupon = 'SAVE10';
  const order = { items, coupon };
  const invoiceFigures = invoice.computeInvoiceFigures(order);
  const checkoutFigures = pricing.computeTotals(items, coupon);

  assert.deepEqual({
    subtotal: invoiceFigures.subtotal,
    discount: invoiceFigures.discount,
    tax: invoiceFigures.tax,
    cgst: invoiceFigures.cgst,
    sgst: invoiceFigures.sgst,
    total: invoiceFigures.total,
    rows: invoiceFigures.rows.map((row) => ({ gstPercent: row.gstPercent, lineTax: row.lineTax }))
  }, {
    subtotal: checkoutFigures.subtotal,
    discount: checkoutFigures.discount,
    tax: checkoutFigures.tax,
    cgst: checkoutFigures.cgst,
    sgst: checkoutFigures.sgst,
    total: checkoutFigures.total,
    rows: [{ gstPercent: 5, lineTax: 104.5 }]
  });
});
