const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const invoice = require(path.join(repoRoot, 'lib', 'invoice'));
const pricing = require(path.join(repoRoot, 'lib', 'pricing'));

function item(id, name, price, qty, hsn, gstRate) {
  return { id, name, price, qty, hsn, gstRate };
}

function order(id, items, coupon, total) {
  return { id, items, coupon, total };
}

function assertCurrentCase(name, currentOrder, expectedInvoice, expectedCheckout) {
  test(name, () => {
    const invoiceFigures = invoice.computeInvoiceFigures(currentOrder);
    const checkoutFigures = pricing.computeTotals(currentOrder.items, currentOrder.coupon);

    assert.deepStrictEqual(
      {
        subtotal: invoiceFigures.subtotal,
        discount: invoiceFigures.discount,
        tax: invoiceFigures.tax,
        cgst: invoiceFigures.cgst,
        sgst: invoiceFigures.sgst,
        total: invoiceFigures.total,
        gstPercents: invoiceFigures.rows.map((row) => row.gstPercent),
      },
      expectedInvoice,
    );
    assert.deepStrictEqual(
      {
        subtotal: checkoutFigures.subtotal,
        discount: checkoutFigures.discount,
        tax: checkoutFigures.tax,
        cgst: checkoutFigures.cgst,
        sgst: checkoutFigures.sgst,
        total: checkoutFigures.total,
      },
      expectedCheckout,
    );
  });
}

assertCurrentCase(
  'CURRENT BEHAVIOUR: #1001 invoice and checkout agree for 5% and 12% items without a coupon',
  order(
    1001,
    [
      item(1, 'Rice', 100, 1, '1006', 5),
      item(2, 'Ghee', 200, 1, '0405', 12),
    ],
    '',
    329,
  ),
  { subtotal: 300, discount: 0, tax: 29, cgst: 14.5, sgst: 14.5, total: 329, gstPercents: [5, 12] },
  { subtotal: 300, discount: 0, tax: 29, cgst: 14.5, sgst: 14.5, total: 329 },
);

assertCurrentCase(
  'CURRENT BEHAVIOUR: #1002 invoice matches checkout SAVE10 totals',
  order(
    1002,
    [
      item(1, 'Rice', 640, 1, '1006', 5),
      item(4, 'Sunflower oil', 190, 2, '1512', 5),
    ],
    'SAVE10',
    963.9,
  ),
  { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9, gstPercents: [5, 5] },
  { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 },
);

assertCurrentCase(
  'CURRENT BEHAVIOUR: #1004 invoice applies the ₹150 checkout discount cap',
  order(
    1004,
    [item(5, 'Groundnut oil', 1120, 2, '1508', 5)],
    'SAVE10',
    2194.5,
  ),
  { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5, gstPercents: [5] },
  { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 },
);

assertCurrentCase(
  'CURRENT BEHAVIOUR: #1008 all-18% items without a coupon agree between invoice and checkout',
  order(
    1008,
    [
      item(8, 'Packaged tea', 140, 1, '0902', 18),
      item(12, 'Kokum concentrate', 180, 2, '2106', 18),
    ],
    '',
    590,
  ),
  { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590, gstPercents: [18, 18] },
  { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590 },
);

test('INVOICE CORRECT BEHAVIOUR: #1004 matches checkout HSN GST and capped SAVE10 totals', () => {
  const currentOrder = order(
    1004,
    [
      item(5, 'Groundnut oil', 1120, 2, '1508', 5),
      item(6, 'Ghee', 450, 1, '0405', 12),
    ],
    'SAVE10',
    2696.74,
  );
  const invoiceFigures = invoice.computeInvoiceFigures(currentOrder);
  const checkoutFigures = pricing.computeTotals(currentOrder.items, currentOrder.coupon);

  assert.deepStrictEqual(
    {
      subtotal: invoiceFigures.subtotal,
      discount: invoiceFigures.discount,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total,
      gstPercents: invoiceFigures.rows.map((row) => row.gstPercent),
      rows: invoiceFigures.rows.map((row) => ({
        gross: row.line,
        tax: row.lineTax,
        gstPercent: row.gstPercent,
      })),
    },
    {
      subtotal: checkoutFigures.subtotal,
      discount: checkoutFigures.discount,
      tax: checkoutFigures.tax,
      cgst: checkoutFigures.cgst,
      sgst: checkoutFigures.sgst,
      total: checkoutFigures.total,
      gstPercents: checkoutFigures.lines.map((line) => line.gstPercent),
      rows: checkoutFigures.lines.map((line) => ({
        gross: line.gross,
        tax: line.tax,
        gstPercent: line.gstPercent,
      })),
    },
  );
});
