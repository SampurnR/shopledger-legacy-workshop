'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// Order creation saves HSN but does not copy an optional gstRate onto its lines.
function figures(items, coupon) {
  return {
    invoice: invoice.computeInvoiceFigures({ items, coupon }),
    checkout: pricing.computeTotals(items, coupon)
  };
}

function summary(result) {
  const { subtotal, discount, tax, cgst, sgst, total } = result;
  return { subtotal, discount, tax, cgst, sgst, total };
}

test('invoice matches checkout for mixed GST slabs and a capped coupon', () => {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 2 },
    { id: 7, name: 'Butter', hsn: '0405', price: 500, qty: 1 }
  ];
  const result = figures(items, 'SAVE10');
  const expected = { subtotal: 2500, discount: 150, tax: 150.4, cgst: 75.2, sgst: 75.2, total: 2500.4 };
  assert.deepStrictEqual(summary(result.checkout), expected);
  assert.deepStrictEqual(summary(result.invoice), expected);
  assert.deepStrictEqual(result.invoice.rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })), [
    { gstPercent: 5, lineTax: 94 },
    { gstPercent: 12, lineTax: 56.4 }
  ]);
});

test('#1001-style mixed 5% and 12% slabs match checkout', () => {
  const items = [
    { id: 2, name: 'Dal', hsn: '0713', price: 165, qty: 2 },
    { id: 7, name: 'Butter', hsn: '0405', price: 280, qty: 1 }
  ];
  const result = figures(items, '');
  assert.deepStrictEqual(summary(result.checkout), { subtotal: 610, discount: 0, tax: 50.1, cgst: 25.05, sgst: 25.05, total: 660.1 });
  assert.deepStrictEqual(summary(result.invoice), { subtotal: 610, discount: 0, tax: 50.1, cgst: 25.05, sgst: 25.05, total: 660.1 });
  assert.deepStrictEqual(result.invoice.rows.map(({ gstPercent, line, lineTax }) => ({ gstPercent, line, lineTax })), [
    { gstPercent: 5, line: 330, lineTax: 16.5 },
    { gstPercent: 12, line: 280, lineTax: 33.6 }
  ]);
});

test('#1002-style SAVE10 applies before GST on the invoice', () => {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 4, name: 'Oil', hsn: '1512', price: 190, qty: 2 }
  ];
  const result = figures(items, 'SAVE10');
  assert.deepStrictEqual(summary(result.checkout), { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 });
  assert.deepStrictEqual(summary(result.invoice), { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 });
  assert.deepStrictEqual(result.invoice.rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })), [
    { gstPercent: 5, lineTax: 28.8 },
    { gstPercent: 5, lineTax: 17.1 }
  ]);
});

test('#1004-style SAVE10 respects the invoice discount cap', () => {
  const items = [{ id: 5, name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 }];
  const result = figures(items, 'SAVE10');
  assert.deepStrictEqual(summary(result.checkout), { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 });
  assert.deepStrictEqual(summary(result.invoice), { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 });
  assert.deepStrictEqual(result.invoice.rows.map(({ gstPercent, line, lineTax }) => ({ gstPercent, line, lineTax })), [
    { gstPercent: 5, line: 2240, lineTax: 104.5 }
  ]);
});

test('#1008-style 18% items without a coupon match checkout', () => {
  const items = [
    { id: 8, name: 'Tea', hsn: '0902', price: 140, qty: 1 },
    { id: 12, name: 'Sherbet', hsn: '2106', price: 180, qty: 2 }
  ];
  const result = figures(items, '');
  const expected = { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590 };
  assert.deepStrictEqual(summary(result.checkout), expected);
  assert.deepStrictEqual(summary(result.invoice), expected);
  assert.deepStrictEqual(result.invoice.rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })), [
    { gstPercent: 18, lineTax: 25.2 },
    { gstPercent: 18, lineTax: 64.8 }
  ]);
});
