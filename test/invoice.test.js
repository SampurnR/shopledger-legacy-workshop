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

test('invoice matches the ledger for order #1002', () => {
  const order = riceOrder();
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    [figures.rows[0].gstPercent, figures.rows[0].lineTax, figures.discount, figures.tax, figures.total],
    [5, 45.90, 102, 45.90, 963.90]
  );

  const html = invoice.render(order);
  assert.match(html, /₹963\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 0);
});

test('invoice applies the SAVE10 cap before calculating mixed GST slabs', () => {
  const order = {
    items: [
      { name: 'Groundnut oil', hsn: '1508', price: 560, qty: 2 },
      { name: 'Ghee', hsn: '0405', price: 1120, qty: 1 }
    ],
    coupon: 'SAVE10'
  };
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    figures.rows.map(row => [row.gstPercent, row.lineTax]),
    [[5, 52.25], [12, 125.40]]
  );
  assert.deepEqual(
    [figures.subtotal, figures.discount, figures.tax, figures.cgst, figures.sgst, figures.total],
    [2240, 150, 177.65, 88.83, 88.82, 2267.65]
  );
});
