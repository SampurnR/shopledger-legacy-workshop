const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function makeOrder(overrides = {}) {
  const items = overrides.items || [
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 600, qty: 1 }
  ];
  const coupon = overrides.coupon || '';
  const totals = pricing.computeTotals(items, coupon);

  return {
    id: 42,
    date: '21/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total,
    ...overrides
  };
}

test('invoice figures match billed GST, split, and total using the order HSN slab', () => {
  const order = makeOrder();
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 30);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.cgst, 15);
  assert.equal(figures.sgst, 15);
  assert.equal(figures.total, order.total);
});

test('invoice applies coupon discount before GST as in the billed calculation', () => {
  const order = makeOrder({ coupon: 'SAVE10' });
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 60);
  assert.equal(order.tax, 27);
  assert.equal(order.total, 567);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
});

test('invoice uses the HSN GST slab used by pricing', () => {
  const order = makeOrder();

  assert.equal(order.tax, 30);
  assert.equal(order.total, 630);
  assert.equal(order.items[0].hsn, '1006');
  assert.equal(order.items[0].gstRate, undefined);

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 30);
  assert.equal(figures.total, 630);
});

test('invoice coupon totals match the billed percent discount and GST', () => {
  const order = makeOrder({ coupon: 'SAVE10' });

  assert.equal(order.discount, 60);
  assert.equal(order.tax, 27);
  assert.equal(order.total, 567);

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, 60);
  assert.equal(figures.tax, 27);
  assert.equal(figures.total, 567);
});

test('reconciliation reports matching invoice and ledger figures for an HSN order', () => {
  const order = makeOrder();
  const db = { orders: [order], products: [], customers: [], settlements: [] };

  const result = reports.getGstReconciliation(db);

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 42,
    date: '21/11/2026',
    customer: 'In-memory customer',
    coupon: '',
    ledgerSubtotal: 600,
    ledgerDiscount: 0,
    ledgerTax: 30,
    ledgerTotal: 630,
    invoiceDiscount: 0,
    invoiceTax: 30,
    invoiceTotal: 630,
    delta: 0,
    matched: true
  });
});

test('rendered invoice prints the billed HSN GST and total without a mismatch notice', () => {
  const order = makeOrder();
  const html = invoice.render(order);

  assert.match(html, /5%/);
  assert.match(html, /₹30\.00/);
  assert.match(html, /Invoice Total/);
  assert.match(html, /₹630\.00/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});
