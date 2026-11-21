const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function riceOrder() {
  return {
    id: 1002,
    date: '05/01/2022',
    items: [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 510, qty: 2 }],
    coupon: 'SAVE10',
    subtotal: 1020,
    discount: 102,
    tax: 45.90,
    total: 963.90
  };
}

test('18% GST without a coupon agrees with checkout', () => {
  const order = { items: [{ name: 'Tea', hsn: '0902', price: 250, qty: 2 }] };
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    [figures.subtotal, figures.discount, figures.tax, figures.total],
    [500, 0, 90, 590]
  );
});

test('CURRENT BEHAVIOUR: invoice uses 18% GST and discounts the tax-inclusive subtotal', () => {
  const figures = invoice.computeInvoiceFigures(riceOrder());
  assert.deepEqual(
    [figures.rows[0].gstPercent, figures.discount, figures.tax, figures.total],
    [18, 120.36, 183.60, 1083.24]
  );
});

test('CURRENT BEHAVIOUR: the invoice and GST Audit both report the ledger mismatch', () => {
  const order = riceOrder();
  assert.match(invoice.render(order), /Accountant Reconciliation Notice/);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 1);
});
