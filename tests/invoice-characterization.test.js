const assert = require('node:assert/strict');
const { test } = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

test('printable invoice matches checkout GST and coupon discount', () => {
  const items = [{ name: 'Rice', hsn: '1006', qty: 1, price: 1020 }];
  const coupon = 'SAVE10';
  const checkout = pricing.computeTotals(items, coupon);
  const printed = invoice.computeInvoiceFigures({ items, coupon });

  assert.deepEqual(
    [checkout.discount, checkout.tax, checkout.total, checkout.lines[0].gstPercent],
    [102, 45.90, 963.90, 5]
  );
  assert.deepEqual(
    [printed.discount, printed.tax, printed.total, printed.rows[0].gstPercent],
    [102, 45.90, 963.90, 5]
  );
});

test('invoice respects the checkout coupon cap', () => {
  const items = [{ name: 'Rice', hsn: '1006', qty: 1, price: 2240 }];
  const coupon = 'SAVE10';

  assert.equal(pricing.computeTotals(items, coupon).discount, 150);
  assert.equal(invoice.computeInvoiceFigures({ items, coupon }).discount, 150);
});

test('GST audit accepts both reconciled invoices', () => {
  const result = reports.getGstReconciliation({
    orders: [
      {
        id: 1002,
        items: [{ name: 'Rice', hsn: '1006', qty: 1, price: 1020 }],
        coupon: 'SAVE10',
        subtotal: 1020,
        discount: 102,
        tax: 45.90,
        total: 963.90
      },
      {
        id: 1008,
        items: [{ name: 'Tea', hsn: '0902', qty: 1, price: 100 }],
        subtotal: 100,
        discount: 0,
        tax: 18,
        total: 118
      }
    ]
  });

  assert.equal(result.totalChecked, 2);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(
    result.rows.map(({ orderId, matched, ledgerTax, invoiceTax, delta }) =>
      [orderId, matched, ledgerTax, invoiceTax, delta]
    ),
    [[1002, true, 45.90, 45.90, 0], [1008, true, 18, 18, 0]]
  );
});
