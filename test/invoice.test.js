const { test } = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function compareFigures(order, expected, expectedInvoiceTaxRows) {
  const { rows, ...invoiceFigures } = invoice.computeInvoiceFigures(order);
  const { lines, taxable, ...checkoutFigures } = pricing.computeTotals(order.items, order.coupon);

  assert.deepEqual(invoiceFigures, expected, 'invoice summary');
  assert.deepEqual(checkoutFigures, expected, 'checkout summary');
  assert.deepEqual(
    rows.map(({ hsn, gstPercent, lineTax }) => ({ hsn, gstPercent, lineTax })),
    expectedInvoiceTaxRows,
    'invoice GST by line'
  );
}

test('#1001 invoice uses the checkout GST slabs for mixed HSN lines', () => {
  const order = {
    id: 1001,
    coupon: '',
    // New order snapshots carry HSN but leave gstRate unset.
    items: [
      { price: 165, qty: 1, hsn: '0713', gstRate: undefined },
      { price: 450, qty: 1, hsn: '0405', gstRate: undefined }
    ]
  };

  compareFigures(
    order,
    { subtotal: 615, discount: 0, tax: 62.25, cgst: 31.13, sgst: 31.12, total: 677.25 },
    [
      { hsn: '0713', gstPercent: 5, lineTax: 8.25 },
      { hsn: '0405', gstPercent: 12, lineTax: 54 }
    ]
  );
});

test('#1002 invoice applies SAVE10 before GST', () => {
  const order = {
    id: 1002,
    coupon: 'SAVE10',
    items: [{ price: 640, qty: 1, hsn: '1006', gstRate: 5 }]
  };

  compareFigures(
    order,
    { subtotal: 640, discount: 64, tax: 28.80, cgst: 14.40, sgst: 14.40, total: 604.80 },
    [{ hsn: '1006', gstPercent: 5, lineTax: 28.80 }]
  );
});

test('#1004 invoice honors the SAVE10 cap on a subtotal of 2240', () => {
  const order = {
    id: 1004,
    coupon: 'SAVE10',
    items: [{ price: 1120, qty: 2, hsn: '1508', gstRate: 5 }]
  };

  compareFigures(
    order,
    { subtotal: 2240, discount: 150, tax: 104.50, cgst: 52.25, sgst: 52.25, total: 2194.50 },
    [{ hsn: '1508', gstPercent: 5, lineTax: 104.50 }]
  );
});

test('CURRENT BEHAVIOUR: #1008 invoice matches checkout for 18% items without a coupon', () => {
  const order = {
    id: 1008,
    coupon: '',
    items: [
      { price: 140, qty: 1, hsn: '0902', gstRate: 18 },
      { price: 180, qty: 2, hsn: '2106', gstRate: 18 }
    ]
  };
  const expected = { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590 };

  compareFigures(order, expected, [
    { hsn: '0902', gstPercent: 18, lineTax: 25.20 },
    { hsn: '2106', gstPercent: 18, lineTax: 64.80 }
  ]);
});
