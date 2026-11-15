const { test } = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function billedOrder(item, coupon) {
  const totals = pricing.computeTotals([item], coupon || '');
  return {
    id: 42,
    date: '15/03/2022',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: [item],
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice uses the HSN tax slab and matches billed totals for an HSN-rated item', () => {
  const order = billedOrder({
    id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 2
  });
  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(billed.tax, 10);
  assert.equal(billed.total, 210);
  assert.equal(invoiced.rows[0].gstPercent, 5);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.cgst, billed.cgst);
  assert.equal(invoiced.sgst, billed.sgst);
  assert.equal(invoiced.total, billed.total);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice applies the configured coupon cap and matches billed post-discount GST', () => {
  const order = billedOrder({
    id: 2, name: 'Tea', sku: 'TEA', hsn: '0902', price: 3000, qty: 1
  }, 'SAVE10');
  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiced = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  }, { subtotal: 3000, discount: 150, tax: 513, total: 3363 });
  assert.deepEqual({
    subtotal: invoiced.subtotal,
    discount: invoiced.discount,
    tax: invoiced.tax,
    total: invoiced.total,
    lineTax: invoiced.rows[0].lineTax
  }, { subtotal: 3000, discount: 150, tax: 513, total: 3363, lineTax: 513 });

  const reconciliation = reports.getGstReconciliation({ orders: [order] });
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
