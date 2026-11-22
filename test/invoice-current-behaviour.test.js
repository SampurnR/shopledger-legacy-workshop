'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

function savedOrder(item, coupon) {
  const totals = pricing.computeTotals([item], coupon || '');
  return {
    id: 42,
    date: '22/11/2026',
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

test('CURRENT BEHAVIOUR: order pricing uses the HSN slab on the discounted taxable value', function () {
  const item = { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 6 };
  const totals = pricing.computeTotals([item], 'SAVE10');

  assert.deepEqual({
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    tax: totals.tax,
    total: totals.total,
    gstPercent: totals.lines[0].gstPercent
  }, {
    subtotal: 600,
    discount: 60,
    taxable: 540,
    tax: 27,
    total: 567,
    gstPercent: 5
  });
});

test('Invoice breakdown uses the same HSN-based GST and totals as order pricing', function () {
  const order = savedOrder(
    { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 6 },
    ''
  );
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(Object.hasOwn(order.items[0], 'gstRate'), false);
  assert.equal(figures.subtotal, order.subtotal);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.cgst, 15);
  assert.equal(figures.sgst, 15);
  assert.equal(figures.total, order.total);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 30);
});

test('Invoice uses the same coupon discount and post-discount GST as order pricing', function () {
  const order = savedOrder(
    { id: 8, sku: 'TEA-1', name: 'Tea', hsn: '0902', price: 100, qty: 6 },
    'WELCOME'
  );
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 30);
  assert.equal(order.tax, 102.6);
  assert.equal(order.total, 672.6);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
  assert.equal(figures.rows[0].lineTax, 102.6);
});

test('Invoice render omits the reconciliation notice when it matches the order ledger', function () {
  const order = savedOrder(
    { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 6 },
    ''
  );
  const html = invoice.render(order);

  assert.match(html, /Invoice Total<\/td><td class="r">₹630\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('Invoice breakdown matches the values used to bill the order', function () {
  const order = savedOrder(
    { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    ''
  );
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    gstPercent: figures.rows[0].gstPercent,
    lineTax: figures.rows[0].lineTax
  }, {
    subtotal: order.subtotal,
    discount: order.discount,
    tax: order.tax,
    cgst: 16,
    sgst: 16,
    total: order.total,
    gstPercent: 5,
    lineTax: 32
  });
});
