const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function makeRiceOrder() {
  const items = [{
    id: 1,
    sku: 'RICE-001',
    name: 'Rice',
    hsn: '1006',
    price: 3000,
    qty: 1
  }];
  const billed = pricing.computeTotals(items, 'SAVE10');

  return {
    id: 42,
    date: '21/11/2026',
    customer: 'In-memory customer',
    status: 'completed',
    paymentMode: 'cash',
    coupon: 'SAVE10',
    items,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
}

test('order pricing applies the HSN slab and coupon before GST (in-memory fixture)', function () {
  const order = makeRiceOrder();

  assert.equal(order.subtotal, 3000);
  assert.equal(order.discount, 150);
  assert.equal(order.tax, 142.5);
  assert.equal(order.total, 2992.5);
});

test('invoice total and GST breakdown match the amount billed on the order', function () {
  const order = makeRiceOrder();
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, order.subtotal);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.cgst + figures.sgst, order.tax);
  assert.equal(figures.total, order.total);
});

test('invoice uses the HSN tax slab used for billing', function () {
  const order = makeRiceOrder();
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.tax, 142.5);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.total, 2992.5);
});

test('invoice applies coupon to subtotal and respects SAVE10 maxDiscount', function () {
  const order = makeRiceOrder();
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 150);
  assert.equal(figures.discount, 150);
});

test('GST reconciliation reports matching billed and invoice figures', function () {
  const order = makeRiceOrder();
  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].matched, true);
  assert.equal(result.rows[0].ledgerTax, 142.5);
  assert.equal(result.rows[0].invoiceTax, 142.5);
  assert.equal(result.rows[0].ledgerTotal, 2992.5);
  assert.equal(result.rows[0].invoiceTotal, 2992.5);
  assert.equal(result.rows[0].delta, 0);
});
