'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function order(id, items, coupon) {
  return { id, items, coupon: coupon || '' };
}

test('CURRENT BEHAVIOUR: #1001 invoice computes 5% and 12% GST with no coupon', function () {
  const items = [
    { id: 'rice', name: 'Rice', sku: 'RICE', hsn: '1006', price: 500, qty: 2, gstRate: 5 },
    { id: 'ghee', name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 200, qty: 2, gstRate: 12 }
  ];
  const current = invoice.computeInvoiceFigures(order(1001, items, ''));
  const billed = pricing.computeTotals(items, '');

  assert.deepEqual(current, {
    subtotal: 1400,
    discount: 0,
    tax: 98,
    cgst: 49,
    sgst: 49,
    total: 1498,
    rows: [
      { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 500, gstPercent: 5, line: 1000, lineTax: 50 },
      { name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 2, price: 200, gstPercent: 12, line: 400, lineTax: 48 }
    ]
  });
  assert.equal(billed.subtotal, 1400);
  assert.equal(billed.tax, 98);
  assert.equal(billed.total, 1498);
});

test('#1002 invoice uses checkout SAVE10 discount before tax', function () {
  const items = [
    { id: 'rice', name: 'Rice', sku: 'RICE', hsn: '1006', price: 300, qty: 2, gstRate: 5 },
    { id: 'ghee', name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 200, qty: 2, gstRate: 12 }
  ];
  const current = invoice.computeInvoiceFigures(order(1002, items, 'SAVE10'));
  const billed = pricing.computeTotals(items, 'SAVE10');

  assert.deepEqual(current, {
    subtotal: 1000,
    discount: 100,
    tax: 70.2,
    cgst: 35.1,
    sgst: 35.1,
    total: 970.2,
    rows: [
      { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 300, gstPercent: 5, line: 600, lineTax: 27 },
      { name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 2, price: 200, gstPercent: 12, line: 400, lineTax: 43.2 }
    ]
  });
  assert.equal(current.discount, billed.discount);
  assert.equal(current.tax, billed.tax);
  assert.equal(current.total, billed.total);
});

test('#1004 invoice applies checkout SAVE10 cap and HSN tax', function () {
  const items = [
    { id: 'rice', name: 'Rice', sku: 'RICE', hsn: '1006', price: 1000, qty: 1, gstRate: 5 },
    { id: 'ghee', name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 1240, qty: 1, gstRate: 12 }
  ];
  const current = invoice.computeInvoiceFigures(order(1004, items, 'SAVE10'));
  const billed = pricing.computeTotals(items, 'SAVE10');

  assert.deepEqual(current, {
    subtotal: 2240,
    discount: 150,
    tax: 185.49,
    cgst: 92.75,
    sgst: 92.74,
    total: 2275.49,
    rows: [
      { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 1, price: 1000, gstPercent: 5, line: 1000, lineTax: 46.65 },
      { name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 1, price: 1240, gstPercent: 12, line: 1240, lineTax: 138.84 }
    ]
  });
  assert.equal(current.discount, billed.discount);
  assert.equal(current.tax, billed.tax);
  assert.equal(current.total, billed.total);
});

test('CURRENT BEHAVIOUR: #1008 all-18% invoice matches pricing without a coupon', function () {
  const items = [
    { id: 'tea', name: 'Tea', sku: 'TEA', hsn: '0902', price: 150, qty: 2, gstRate: 18 },
    { id: 'coffee', name: 'Coffee', sku: 'COFFEE', hsn: '0901', price: 100, qty: 2, gstRate: 18 }
  ];
  const current = invoice.computeInvoiceFigures(order(1008, items, ''));
  const billed = pricing.computeTotals(items, '');

  assert.deepEqual(current, {
    subtotal: 500,
    discount: 0,
    tax: 90,
    cgst: 45,
    sgst: 45,
    total: 590,
    rows: [
      { name: 'Tea', sku: 'TEA', hsn: '0902', qty: 2, price: 150, gstPercent: 18, line: 300, lineTax: 54 },
      { name: 'Coffee', sku: 'COFFEE', hsn: '0901', qty: 2, price: 100, gstPercent: 18, line: 200, lineTax: 36 }
    ]
  });
  assert.equal(billed.subtotal, 500);
  assert.equal(billed.tax, 90);
  assert.equal(billed.total, 590);
});

test('invoice follows checkout HSN GST and capped coupon for #1004', function () {
  const items = [
    { id: 5, name: 'Cold-Pressed Groundnut Oil 5L', sku: 'OIL-002', hsn: '1508', price: 1120, qty: 2 }
  ];
  const current = invoice.computeInvoiceFigures(order(1004, items, 'SAVE10'));
  const checkout = pricing.computeTotals(items, 'SAVE10');

  assert.equal(checkout.discount, 150);
  assert.equal(checkout.tax, 104.5);
  assert.equal(checkout.total, 2194.5);
  assert.equal(current.rows[0].gstPercent, checkout.lines[0].gstPercent);
  assert.equal(current.subtotal, checkout.subtotal);
  assert.equal(current.discount, checkout.discount);
  assert.equal(current.tax, checkout.tax);
  assert.equal(current.cgst, checkout.cgst);
  assert.equal(current.sgst, checkout.sgst);
  assert.equal(current.total, checkout.total);
});
