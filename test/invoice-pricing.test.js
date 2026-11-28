'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function orderFromCheckout(items, coupon) {
  const totals = pricing.computeTotals(items, coupon);
  return {
    id: 42,
    date: '28/11/2026',
    customer: 'Test Customer',
    status: 'completed',
    paymentMode: 'cash',
    items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('CURRENT BEHAVIOUR — checkout applies the HSN slab and coupon to taxable subtotal', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 600, qty: 1 }];

  assert.deepEqual(pricing.computeTotals(items, 'SAVE10'), {
    subtotal: 600,
    discount: 60,
    taxable: 540,
    tax: 27,
    cgst: 13.5,
    sgst: 13.5,
    total: 567,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 600,
      discount: 60,
      taxable: 540,
      tax: 27,
      net: 567
    }]
  });
});

test('invoice figures match the amounts and HSN tax used at checkout', () => {
  const order = orderFromCheckout([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 }
  ], 'SAVE10');

  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, order.subtotal);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 28.8);
});

test('invoice uses checkout HSN slab and discounted taxable amount', () => {
  const order = orderFromCheckout([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 600, qty: 1 }
  ], 'SAVE10');

  assert.equal(order.total, 567);
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 600,
    discount: 60,
    tax: 27,
    cgst: 13.5,
    sgst: 13.5,
    total: 567,
    rows: [{
      name: 'Rice',
      sku: 'RICE-1',
      hsn: '1006',
      qty: 1,
      price: 600,
      gstPercent: 5,
      line: 600,
      lineTax: 27
    }]
  });
});

test('GST reconciliation reports checkout figures as matched', () => {
  const order = orderFromCheckout([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 600, qty: 1 }
  ], 'SAVE10');

  const result = reports.getGstReconciliation({
    orders: [order],
    products: [],
    customers: []
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 42,
    date: '28/11/2026',
    customer: 'Test Customer',
    coupon: 'SAVE10',
    ledgerSubtotal: 600,
    ledgerDiscount: 60,
    ledgerTax: 27,
    ledgerTotal: 567,
    invoiceDiscount: 60,
    invoiceTax: 27,
    invoiceTotal: 567,
    delta: 0,
    matched: true
  });
});

test('rendered invoice displays the billed total without a mismatch notice', () => {
  const order = orderFromCheckout([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 600, qty: 1 }
  ], 'SAVE10');

  const html = invoice.render(order);

  assert.match(html, /Invoice Total<\/td><td class="r">₹567\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
