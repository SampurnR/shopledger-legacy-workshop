const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function compareFigures(items, coupon) {
  const { lines, taxable, ...checkout } = pricing.computeTotals(items, coupon);
  const { rows, ...printable } = invoice.computeInvoiceFigures({
    items,
    coupon,
    total: checkout.total
  });

  return {
    printable,
    checkout,
    invoiceGst: rows.map(({ gstPercent, lineTax }) => ({ gstPercent, tax: lineTax })),
    checkoutGst: lines.map(({ gstPercent, tax }) => ({ gstPercent, tax }))
  };
}

test('invoice uses checkout GST slabs and the capped SAVE10 discount before tax', () => {
  const items = [
    { name: 'Rice', price: 280, qty: 4, hsn: '1006' },
    { name: 'Ghee', price: 560, qty: 2, hsn: '0405' }
  ];
  const figures = compareFigures(items, 'SAVE10');
  const expectedTotals = {
    subtotal: 2240, discount: 150, tax: 177.65, cgst: 88.83, sgst: 88.82, total: 2267.65
  };
  const expectedGst = [{ gstPercent: 5, tax: 52.25 }, { gstPercent: 12, tax: 125.4 }];

  assert.deepStrictEqual(figures.checkout, expectedTotals);
  assert.deepStrictEqual(figures.checkoutGst, expectedGst);
  assert.deepStrictEqual(figures.printable, expectedTotals);
  assert.deepStrictEqual(figures.invoiceGst, expectedGst);
});

test('CURRENT BEHAVIOUR: #1001-like invoice uses the 5% and 12% HSN slabs', () => {
  // Saved-order lines can have HSN without an explicit gstRate.
  const items = [
    { name: 'Rice', price: 100, qty: 2, hsn: '1006' },
    { name: 'Ghee', price: 300, qty: 1, hsn: '0405' }
  ];

  assert.deepStrictEqual(compareFigures(items, ''), {
    printable: { subtotal: 500, discount: 0, tax: 46, cgst: 23, sgst: 23, total: 546 },
    checkout: { subtotal: 500, discount: 0, tax: 46, cgst: 23, sgst: 23, total: 546 },
    invoiceGst: [{ gstPercent: 5, tax: 10 }, { gstPercent: 12, tax: 36 }],
    checkoutGst: [{ gstPercent: 5, tax: 10 }, { gstPercent: 12, tax: 36 }]
  });
});

test('CURRENT BEHAVIOUR: #1002-like invoice applies SAVE10 before GST', () => {
  const items = [{ name: 'Packaged tea', price: 300, qty: 2, hsn: '0902' }];

  assert.deepStrictEqual(compareFigures(items, 'SAVE10'), {
    printable: { subtotal: 600, discount: 60, tax: 97.2, cgst: 48.6, sgst: 48.6, total: 637.2 },
    checkout: { subtotal: 600, discount: 60, tax: 97.2, cgst: 48.6, sgst: 48.6, total: 637.2 },
    invoiceGst: [{ gstPercent: 18, tax: 97.2 }],
    checkoutGst: [{ gstPercent: 18, tax: 97.2 }]
  });
});

test('CURRENT BEHAVIOUR: #1004-like invoice caps SAVE10 at 150 on 2240', () => {
  const items = [{ name: 'Ghee', price: 560, qty: 4, hsn: '0405', gstRate: 12 }];

  assert.deepStrictEqual(compareFigures(items, 'SAVE10'), {
    printable: { subtotal: 2240, discount: 150, tax: 250.8, cgst: 125.4, sgst: 125.4, total: 2340.8 },
    checkout: { subtotal: 2240, discount: 150, tax: 250.8, cgst: 125.4, sgst: 125.4, total: 2340.8 },
    invoiceGst: [{ gstPercent: 12, tax: 250.8 }],
    checkoutGst: [{ gstPercent: 12, tax: 250.8 }]
  });
});

test('CURRENT BEHAVIOUR: #1008-like invoice matches checkout for 18% items without a coupon', () => {
  const items = [
    { name: 'Packaged tea', price: 120, qty: 2, hsn: '0902' },
    { name: 'Coffee', price: 160, qty: 1, hsn: '0901' }
  ];
  const expectedTotals = { subtotal: 400, discount: 0, tax: 72, cgst: 36, sgst: 36, total: 472 };
  const expectedGst = [{ gstPercent: 18, tax: 43.2 }, { gstPercent: 18, tax: 28.8 }];

  assert.deepStrictEqual(compareFigures(items, ''), {
    printable: expectedTotals,
    checkout: expectedTotals,
    invoiceGst: expectedGst,
    checkoutGst: expectedGst
  });
});
