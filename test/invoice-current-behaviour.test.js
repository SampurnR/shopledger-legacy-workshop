const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function createInMemoryOrder(items, coupon) {
  const totals = pricing.computeTotals(items, coupon);
  const db = { nextOrderId: 1, orders: [] };
  const order = orders.add(db, {
    date: '18/11/2026',
    items,
    coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });

  return { order, totals };
}

test('invoice uses the billed HSN slab and matches the order totals', () => {
  const items = [{
    id: 1,
    sku: 'GRN-001',
    name: 'Rice',
    hsn: '1006',
    price: 1000,
    qty: 1
  }];
  const { order, totals } = createInMemoryOrder(items, '');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.items[0].hsn, '1006');
  assert.equal(order.items[0].gstRate, undefined);
  assert.deepEqual(
    [figures.rows[0].gstPercent, figures.rows[0].lineTax,
      figures.tax, figures.cgst, figures.sgst, figures.total],
    [5, 50, totals.tax, totals.cgst, totals.sgst, order.total]
  );

  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹1050\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice applies the SAVE10 cap and matches discounted HSN GST totals', () => {
  const items = [{
    id: 1,
    sku: 'GRN-001',
    name: 'Rice',
    hsn: '1006',
    price: 3000,
    qty: 1
  }];
  const { order, totals } = createInMemoryOrder(items, 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    [totals.discount, totals.tax, order.total],
    [150, 142.5, 2992.5]
  );
  assert.deepEqual(
    [figures.rows[0].gstPercent, figures.rows[0].lineTax,
      figures.tax, figures.discount, figures.total],
    [5, totals.tax, totals.tax, totals.discount, order.total]
  );
});

test('invoice figures match the billed HSN GST breakdown and total', () => {
  const items = [{
    id: 1,
    sku: 'GRN-001',
    name: 'Indrayani Basmati Rice 5kg',
    hsn: '1006',
    price: 640,
    qty: 1
  }];
  const { order, totals } = createInMemoryOrder(items, '');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    [figures.rows[0].gstPercent, figures.rows[0].lineTax, figures.tax,
      figures.cgst, figures.sgst, figures.total],
    [5, 32, totals.tax, totals.cgst, totals.sgst, totals.total]
  );
});

test('GST reconciliation still detects a difference from the recorded order total', () => {
  const items = [{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 640,
    qty: 1
  }];
  const { order } = createInMemoryOrder(items, '');
  order.total += 1;

  const reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(reconciliation.mismatchCount, 1);
  assert.equal(reconciliation.rows[0].matched, false);
  assert.equal(reconciliation.rows[0].delta, -1);
});
