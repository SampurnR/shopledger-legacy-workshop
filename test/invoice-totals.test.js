'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function riceOrder(overrides = {}) {
  return {
    id: 1,
    customer: 'In-memory test customer',
    date: '01/01/2022',
    status: 'completed',
    paymentMode: 'cash',
    items: [{ id: 1, name: 'Test rice', sku: 'TEST-RICE', hsn: '1006', price: 1000, qty: 1 }],
    coupon: '',
    ...overrides
  };
}

function invoiceValues(figures) {
  return {
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    lines: figures.rows.map((line) => ({ gstPercent: line.gstPercent, tax: line.lineTax }))
  };
}

function billedValues(totals) {
  return {
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    cgst: totals.cgst,
    sgst: totals.sgst,
    total: totals.total,
    lines: totals.lines.map((line) => ({ gstPercent: line.gstPercent, tax: line.tax }))
  };
}

test('billing uses the HSN slab and applies coupon discount before GST', () => {
  const items = riceOrder().items;
  const totals = pricing.computeTotals(items, 'SAVE10');

  assert.equal(totals.subtotal, 1000);
  assert.equal(totals.discount, 100);
  assert.equal(totals.lines[0].gstPercent, 5);
  assert.equal(totals.lines[0].taxable, 900);
  assert.equal(totals.tax, 45);
  assert.equal(totals.cgst, 22.5);
  assert.equal(totals.sgst, 22.5);
  assert.equal(totals.total, 945);
});

test('invoice resolves GST from the item HSN and matches billing', () => {
  const order = riceOrder();
  const billed = pricing.computeTotals(order.items, order.coupon);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(invoiceValues(figures), billedValues(billed));
  assert.equal(figures.rows[0].hsn, '1006');
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 50);
  assert.equal(figures.total, 1050);
});

test('invoice coupon discount and GST match the billed post-discount calculation', () => {
  const order = riceOrder({ coupon: 'SAVE10' });
  const billed = pricing.computeTotals(order.items, order.coupon);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(invoiceValues(figures), billedValues(billed));
  assert.equal(figures.discount, 100);
  assert.equal(figures.tax, 45);
  assert.equal(figures.cgst, 22.5);
  assert.equal(figures.sgst, 22.5);
  assert.equal(figures.total, 945);
  assert.equal(figures.rows[0].lineTax, 45);
});

test('invoice applies the same configured coupon maximum discount as billing', () => {
  const order = riceOrder({
    coupon: 'WELCOME',
    items: [{ id: 2, name: 'Test tea', sku: 'TEST-TEA', hsn: '0902', price: 3000, qty: 1 }]
  });
  const billed = pricing.computeTotals(order.items, order.coupon);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(invoiceValues(figures), billedValues(billed));
  assert.equal(figures.discount, 100);
  assert.equal(figures.tax, 522);
  assert.equal(figures.total, 3422);
});

test('printable invoice shows billed total and GST without a reconciliation warning', () => {
  const order = riceOrder({ coupon: 'SAVE10' });
  const billed = pricing.computeTotals(order.items, order.coupon);
  order.tax = billed.tax;
  order.total = billed.total;
  const html = invoice.render(order);

  assert.match(html, /5%/);
  assert.match(html, /45\.00/);
  assert.match(html, /945\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
