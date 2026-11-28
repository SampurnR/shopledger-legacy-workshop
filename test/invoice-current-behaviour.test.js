'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const coupons = require('../lib/coupons');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function makeOrder(items, coupon) {
  const totals = pricing.computeTotals(items, coupon || '');
  const db = { nextOrderId: 1001, orders: [] };
  const order = orders.add(db, {
    date: '28/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });

  return { db, order, totals };
}

test('invoice total and GST breakdown match the HSN-based amount saved for the customer', () => {
  const items = [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const { db, order, totals } = makeOrder(items);
  const invoiceFigures = invoice.computeInvoiceFigures(order);
  const reconciliation = reports.getGstReconciliation(db);

  assert.equal(totals.tax, 5);
  assert.equal(order.total, 105);
  assert.equal(invoiceFigures.tax, order.tax);
  assert.equal(invoiceFigures.total, order.total);
  assert.equal(invoiceFigures.rows.reduce((sum, row) => sum + row.lineTax, 0), totals.tax);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice WELCOME discount and GST match order pricing', () => {
  const items = [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 2000, qty: 1 }];
  const { order, totals } = makeOrder(items, 'WELCOME');
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(totals.discount, 100);
  assert.equal(totals.tax, 95);
  assert.equal(totals.total, 1995);
  assert.equal(invoiceFigures.tax, totals.tax);
  assert.equal(invoiceFigures.discount, totals.discount);
  assert.equal(invoiceFigures.total, totals.total);
});

test('inactive coupon is not included in invoice figures', () => {
  const items = [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];
  const { order } = makeOrder(items, 'DIWALI20');
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(coupons.validate('DIWALI20', 1000), {
    valid: false,
    error: 'Coupon DIWALI20 has expired'
  });
  assert.equal(invoiceFigures.discount, 0);
  assert.equal(invoiceFigures.total, 1050);
});
