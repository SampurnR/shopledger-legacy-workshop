const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function billedOrder() {
  const items = [
    { id: 1, name: 'Rice', sku: 'R', hsn: '1006', price: 640, qty: 1 },
    { id: 8, name: 'Tea', sku: 'T', hsn: '0902', price: 140, qty: 1 }
  ];
  const totals = pricing.computeTotals(items, 'SAVE10');
  return {
    id: 1,
    customer: 'Walk-in',
    status: 'completed',
    items,
    coupon: 'SAVE10',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('CURRENT BEHAVIOUR: order pricing uses HSN rates and applies SAVE10 before GST', () => {
  const order = billedOrder();

  assert.equal(order.subtotal, 780);
  assert.equal(order.discount, 78);
  assert.equal(order.tax, 51.48);
  assert.equal(order.total, 753.48);
  assert.deepEqual(order.items.map((item) => item.hsn), ['1006', '0902']);
});

test('CORRECT BEHAVIOUR: invoice uses the same HSN GST rates as order pricing', () => {
  const figures = invoice.computeInvoiceFigures(billedOrder());

  assert.deepEqual(figures.rows.map((row) => row.gstPercent), [5, 18]);
  assert.equal(figures.tax, 51.48);
});

test('CORRECT BEHAVIOUR: invoice applies the same coupon discount as order pricing', () => {
  const figures = invoice.computeInvoiceFigures(billedOrder());

  assert.equal(figures.discount, 78);
  assert.equal(figures.total, 753.48);
});

test('CORRECT BEHAVIOUR: GST reconciliation finds no mismatch for a billed order', () => {
  const order = billedOrder();
  const result = reports.getGstReconciliation({
    orders: [order],
    products: [],
    customers: []
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].ledgerTax, 51.48);
  assert.equal(result.rows[0].invoiceTax, 51.48);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});

test('CORRECT BEHAVIOUR: rendered invoice does not warn when figures match', () => {
  const html = invoice.render(billedOrder());

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});

test('CORRECT BEHAVIOUR: invoice figures match the amount billed by order pricing', () => {
  const order = billedOrder();
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
});
