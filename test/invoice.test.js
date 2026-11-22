const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

test('invoice matches checkout for mixed HSN slabs and a capped coupon', () => {
  const items = [
    { name: 'Rice', price: 560, qty: 2, hsn: '1006' },
    { name: 'Ghee', price: 1120, qty: 1, hsn: '0405' }
  ];
  const result = calculate(items, 'SAVE10');

  assert.deepEqual(result.invoice, result.checkout);
  assert.equal(result.invoice.discount, 150);
  assert.deepEqual(result.invoiceLines, [[5, 52.25], [12, 125.4]]);
  assert.deepEqual(result.invoiceLines, result.checkoutLines);
  assert.equal(invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' }).total, 2267.65);

  const billed = { subtotal: 2240, discount: 100, tax: 181.9, total: 2321.9 };
  const reprint = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10', ...billed });
  const { rows, ...summary } = reprint;
  assert.deepEqual(summary, { ...billed, cgst: 90.95, sgst: 90.95 });
});

function calculate(items, coupon = '') {
  const checkout = pricing.computeTotals(items, coupon);
  const printed = invoice.computeInvoiceFigures({ items, coupon, total: checkout.total });
  const figures = ({ subtotal, discount, tax, cgst, sgst, total }) =>
    ({ subtotal, discount, tax, cgst, sgst, total });

  return {
    invoice: figures(printed),
    checkout: figures(checkout),
    invoiceLines: printed.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]),
    checkoutLines: checkout.lines.map(({ gstPercent, tax }) => [gstPercent, tax])
  };
}

test('CURRENT BEHAVIOUR: #1001 invoice uses the 5% and 12% HSN slabs', () => {
  // No gstRate override on either line, so checkout resolves the HSN slabs.
  const items = [
    { name: 'Rice', price: 100, qty: 2, hsn: '1006' },
    { name: 'Ghee', price: 300, qty: 1, hsn: '0405' }
  ];

  assert.deepEqual(calculate(items), {
    invoice: { subtotal: 500, discount: 0, tax: 46, cgst: 23, sgst: 23, total: 546 },
    checkout: { subtotal: 500, discount: 0, tax: 46, cgst: 23, sgst: 23, total: 546 },
    invoiceLines: [[5, 10], [12, 36]],
    checkoutLines: [[5, 10], [12, 36]]
  });
});

test('CURRENT BEHAVIOUR: #1002 invoice applies SAVE10 before GST', () => {
  // A shared explicit rate isolates the effect of the coupon calculation.
  const items = [{ name: 'Rice', price: 200, qty: 3, hsn: '1006', gstRate: 5 }];

  assert.deepEqual(calculate(items, 'SAVE10'), {
    invoice: { subtotal: 600, discount: 60, tax: 27, cgst: 13.5, sgst: 13.5, total: 567 },
    checkout: { subtotal: 600, discount: 60, tax: 27, cgst: 13.5, sgst: 13.5, total: 567 },
    invoiceLines: [[5, 27]],
    checkoutLines: [[5, 27]]
  });
});

test('CURRENT BEHAVIOUR: #1004 invoice applies the SAVE10 cap on 2240', () => {
  const items = [{ name: 'Tea', price: 560, qty: 4, hsn: '0902' }];

  assert.deepEqual(calculate(items, 'SAVE10'), {
    invoice: { subtotal: 2240, discount: 150, tax: 376.2, cgst: 188.1, sgst: 188.1, total: 2466.2 },
    checkout: { subtotal: 2240, discount: 150, tax: 376.2, cgst: 188.1, sgst: 188.1, total: 2466.2 },
    invoiceLines: [[18, 376.2]],
    checkoutLines: [[18, 376.2]]
  });
});

test('CURRENT BEHAVIOUR: #1008 invoice matches checkout for all-18% lines without a coupon', () => {
  const items = [
    { name: 'Tea', price: 150, qty: 2, hsn: '0902' },
    { name: 'Coffee', price: 500, qty: 1, hsn: '0901' }
  ];

  const expected = { subtotal: 800, discount: 0, tax: 144, cgst: 72, sgst: 72, total: 944 };
  assert.deepEqual(calculate(items), {
    invoice: expected,
    checkout: expected,
    invoiceLines: [[18, 54], [18, 90]],
    checkoutLines: [[18, 54], [18, 90]]
  });
});
