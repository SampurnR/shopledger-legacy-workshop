'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function apiShapedOrder(items, coupon) {
  const totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 41,
    date: '24/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('Invoice uses the HSN slab recorded by order pricing and reconciliation matches', function () {
  // routes/orders.js persists id, sku, name, hsn, price, qty; it does not persist gstRate.
  const order = apiShapedOrder([
    { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ]);

  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);
  const reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.deepEqual(
    { tax: billed.tax, total: billed.total, gstPercent: billed.lines[0].gstPercent },
    { tax: 5, total: 105, gstPercent: 5 }
  );
  assert.deepEqual(
    { tax: invoiceFigures.tax, total: invoiceFigures.total, gstPercent: invoiceFigures.rows[0].gstPercent },
    { tax: billed.tax, total: billed.total, gstPercent: billed.lines[0].gstPercent }
  );
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});

test('Invoice GST breakdown and total match the values recorded when the customer is billed', function () {
  const order = apiShapedOrder([
    { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 640, qty: 1 }
  ], 'WELCOME');

  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      subtotal: invoiceFigures.subtotal,
      discount: invoiceFigures.discount,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total,
      lineGstPercent: invoiceFigures.rows[0].gstPercent
    },
    {
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      cgst: 15.2,
      sgst: 15.2,
      total: order.total,
      lineGstPercent: 5
    }
  );
});

test('Invoice percent coupon and GST breakdown match order pricing', function () {
  const order = apiShapedOrder([
    { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ], 'WELCOME');

  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: billed.discount, tax: billed.tax, total: billed.total },
    { discount: 5, tax: 4.75, total: 99.75 }
  );
  assert.deepEqual(
    { discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { discount: billed.discount, tax: billed.tax, total: billed.total }
  );
});

test('Invoice does not apply a coupon below its configured order minimum', function () {
  const order = apiShapedOrder([
    { id: 2, sku: 'GRN-002', name: 'Dal', hsn: '0713', price: 100, qty: 1 }
  ], 'WHOLESALE15');

  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 0);
  assert.equal(billed.total, 105);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
});

test('Invoice honors the configured maximum percent coupon discount', function () {
  const order = apiShapedOrder([
    { id: 8, sku: 'BEV-001', name: 'Tea', hsn: '0902', price: 2000, qty: 1 }
  ], 'SAVE10');

  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 150);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
});

test('Invoice honors a stored gstRate as a whole-number percent', function () {
  const figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', price: 100, qty: 1, gstRate: 5 }]
  });

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
});
