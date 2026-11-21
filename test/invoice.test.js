'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// Like saved order lines, these fixtures omit gstRate so checkout uses HSN.
function compare(items, coupon) {
  return {
    invoice: invoice.computeInvoiceFigures({ items, coupon }),
    checkout: pricing.computeTotals(items, coupon)
  };
}

function totals(result) {
  const { subtotal, discount, tax, cgst, sgst, total } = result;
  return { subtotal, discount, tax, cgst, sgst, total };
}

test('invoice matches checkout for mixed GST slabs and capped SAVE10', () => {
  const items = [
    { id: 5, name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 },
    { id: 7, name: 'Butter', hsn: '0405', price: 500, qty: 2 }
  ];
  const result = compare(items, 'SAVE10');
  assert.equal(result.invoice.discount, 150);
  assert.deepEqual(totals(result.invoice), totals(result.checkout));
  assert.deepEqual(result.invoice.rows.map(row => [row.gstPercent, row.lineTax]),
    result.checkout.lines.map(line => [line.gstPercent, line.tax]));
  assert.deepEqual(result.invoice.rows.map(row => row.gstPercent), [5, 12]);

  const historic = invoice.computeInvoiceFigures({
    items: [{ id: 5, name: 'Oil', hsn: '1508', price: 1000, qty: 1 }],
    coupon: 'DIWALI20', subtotal: 1000, discount: 200, tax: 40, total: 840
  });
  assert.deepEqual(totals(historic), { subtotal: 1000, discount: 200, tax: 40, cgst: 20, sgst: 20, total: 840 });
  assert.deepEqual(historic.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 40]]);

  const changedSlab = {
    items: [{ name: 'Item', hsn: '0405', price: 100, qty: 1 }],
    coupon: '', subtotal: 100, discount: 0, tax: 5, total: 105
  };
  const historicSlab = invoice.computeInvoiceFigures(changedSlab);
  assert.equal(historicSlab.breakdownUnavailable, true);
  assert.deepEqual(historicSlab.rows.map(row => [row.gstPercent, row.lineTax]), [[null, null]]);
  assert.equal(historicSlab.tax, 5);
  assert.match(invoice.render(changedSlab), /original line GST breakdown is unavailable/);
});

test('mixed 5% and 12% HSN items use their checkout rates on invoice', () => {
  // Inspired by #1001; the 12% item is substituted to cover the requested slab.
  const items = [
    { id: 2, name: 'Dal', hsn: '0713', price: 165, qty: 2 },
    { id: 7, name: 'Butter', hsn: '0405', price: 140, qty: 2 }
  ];
  const result = compare(items, '');
  assert.deepEqual(totals(result.invoice), { subtotal: 610, discount: 0, tax: 50.1, cgst: 25.05, sgst: 25.05, total: 660.1 });
  assert.deepEqual(result.invoice.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 16.5], [12, 33.6]]);
  assert.deepEqual(totals(result.checkout), { subtotal: 610, discount: 0, tax: 50.1, cgst: 25.05, sgst: 25.05, total: 660.1 });
});

test('SAVE10 invoice applies the discount before GST', () => {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 4, name: 'Oil', hsn: '1512', price: 190, qty: 2 }
  ];
  const result = compare(items, 'SAVE10');
  assert.deepEqual(totals(result.invoice), { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 });
  assert.deepEqual(result.invoice.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 28.8], [5, 17.1]]);
  assert.deepEqual(totals(result.checkout), { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 });
});

test('SAVE10 invoice applies the 150 rupee cap', () => {
  const items = [{ id: 5, name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 }];
  const result = compare(items, 'SAVE10');
  assert.deepEqual(totals(result.invoice), { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 });
  assert.deepEqual(result.invoice.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 104.5]]);
  assert.deepEqual(totals(result.checkout), { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 });
});

test('CURRENT BEHAVIOUR: 18% items without a coupon match checkout', () => {
  const items = [
    { id: 8, name: 'Tea', hsn: '0902', price: 140, qty: 1 },
    { id: 12, name: 'Sherbet', hsn: '2106', price: 180, qty: 2 }
  ];
  const result = compare(items, '');
  assert.deepEqual(totals(result.invoice), { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590 });
  assert.deepEqual(result.invoice.rows.map(row => [row.gstPercent, row.lineTax]), [[18, 25.2], [18, 64.8]]);
  assert.deepEqual(totals(result.checkout), totals(result.invoice));
});

test('CURRENT BEHAVIOUR: explicit whole-number gstRate is used by both calculations', () => {
  const items = [
    { id: 2, name: 'Dal', hsn: '0713', gstRate: 5, price: 165, qty: 2 },
    { id: 7, name: 'Butter', hsn: '0405', gstRate: 12, price: 140, qty: 2 }
  ];
  const result = compare(items, '');
  assert.deepEqual(totals(result.invoice), { subtotal: 610, discount: 0, tax: 50.1, cgst: 25.05, sgst: 25.05, total: 660.1 });
  assert.deepEqual(result.invoice.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 16.5], [12, 33.6]]);
  assert.deepEqual(totals(result.checkout), totals(result.invoice));
});
