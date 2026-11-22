'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function item(name, sku, hsn, price, qty, gstRate) {
  return { name, sku, hsn, price, qty, gstRate };
}

function compare(order, expectedInvoice, expectedCheckout) {
  const invoiceFigures = invoice.computeInvoiceFigures(order);
  const checkoutFigures = pricing.computeTotals(order.items, order.coupon);

  assert.deepEqual(invoiceFigures, expectedInvoice);
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

test('CURRENT BEHAVIOUR: Order #1001 uses provided 5% and 12% rates with no coupon', function () {
  compare(
    {
      id: 1001,
      coupon: '',
      items: [
        item('Toor Dal', 'GRN-002', '0713', 165, 2, 5),
        item('Ghee', 'DRY-001', '0405', 450, 1, 12)
      ]
    },
    {
      subtotal: 780,
      discount: 0,
      tax: 70.5,
      cgst: 35.25,
      sgst: 35.25,
      total: 850.5,
      rows: [
        { name: 'Toor Dal', sku: 'GRN-002', hsn: '0713', qty: 2, price: 165, gstPercent: 5, line: 330, lineTax: 16.5 },
        { name: 'Ghee', sku: 'DRY-001', hsn: '0405', qty: 1, price: 450, gstPercent: 12, line: 450, lineTax: 54 }
      ]
    },
    { subtotal: 780, discount: 0, tax: 70.5, cgst: 35.25, sgst: 35.25, total: 850.5 }
  );
});

test('CORRECT BEHAVIOUR: Order #1002 applies SAVE10 before GST', function () {
  compare(
    {
      id: 1002,
      coupon: 'SAVE10',
      items: [
        item('Rice', 'GRN-001', '1006', 640, 1, 5),
        item('Sunflower Oil', 'OIL-001', '1512', 190, 2, 5)
      ]
    },
    {
      subtotal: 1020,
      discount: 102,
      tax: 45.9,
      cgst: 22.95,
      sgst: 22.95,
      total: 963.9,
      rows: [
        { name: 'Rice', sku: 'GRN-001', hsn: '1006', qty: 1, price: 640, gstPercent: 5, line: 640, lineTax: 28.8 },
        { name: 'Sunflower Oil', sku: 'OIL-001', hsn: '1512', qty: 2, price: 190, gstPercent: 5, line: 380, lineTax: 17.1 }
      ]
    },
    { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 }
  );
});

test('CORRECT BEHAVIOUR: Order #1004 applies SAVE10 cap before GST', function () {
  compare(
    {
      id: 1004,
      coupon: 'SAVE10',
      items: [item('Groundnut Oil', 'OIL-002', '1508', 1120, 2, 5)]
    },
    {
      subtotal: 2240,
      discount: 150,
      tax: 104.5,
      cgst: 52.25,
      sgst: 52.25,
      total: 2194.5,
      rows: [
        { name: 'Groundnut Oil', sku: 'OIL-002', hsn: '1508', qty: 2, price: 1120, gstPercent: 5, line: 2240, lineTax: 104.5 }
      ]
    },
    { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 }
  );
});

test('CURRENT BEHAVIOUR: Order #1008 with 18% items and no coupon matches checkout', function () {
  compare(
    {
      id: 1008,
      coupon: '',
      items: [
        item('Packaged Tea', 'BEV-001', '0902', 140, 1, 18),
        item('Sherbet Concentrate', 'BEV-003', '2106', 180, 2, 18)
      ]
    },
    {
      subtotal: 500,
      discount: 0,
      tax: 90,
      cgst: 45,
      sgst: 45,
      total: 590,
      rows: [
        { name: 'Packaged Tea', sku: 'BEV-001', hsn: '0902', qty: 1, price: 140, gstPercent: 18, line: 140, lineTax: 25.2 },
        { name: 'Sherbet Concentrate', sku: 'BEV-003', hsn: '2106', qty: 2, price: 180, gstPercent: 18, line: 360, lineTax: 64.8 }
      ]
    },
    { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590 }
  );
});

test('CORRECT BEHAVIOUR: Order #1004 invoice matches HSN tax and capped checkout discount', function () {
  const order = {
    id: 1004,
    coupon: 'SAVE10',
    items: [item('Groundnut Oil', 'OIL-002', '1508', 1120, 2, undefined)]
  };
  const checkout = pricing.computeTotals(order.items, order.coupon);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures, {
    subtotal: checkout.subtotal,
    discount: checkout.discount,
    tax: checkout.tax,
    cgst: checkout.cgst,
    sgst: checkout.sgst,
    total: checkout.total,
    rows: [
      {
        name: 'Groundnut Oil',
        sku: 'OIL-002',
        hsn: '1508',
        qty: 2,
        price: 1120,
        gstPercent: 5,
        line: 2240,
        lineTax: 104.5
      }
    ]
  });
});
