'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// These fixtures stay entirely in memory; this file does not access the data store.
const rice = [{ id: 1, name: 'Rice', price: 100, qty: 1, hsn: '1006' }];

test('invoice matches billed totals and GST breakdown for an HSN-only order', () => {
  const items = [{
    id: 1,
    sku: 'GRN-001',
    name: 'Indrayani Basmati Rice 5kg',
    price: 640,
    qty: 1,
    hsn: '1006'
  }];
  const billed = pricing.computeTotals(items, '');
  const order = { id: 1009, items, coupon: '', ...billed };
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(billed.tax, 32);
  assert.equal(billed.total, 672);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
  assert.equal(printed.total, billed.total);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice keeps the amounts recorded on a historical order', () => {
  const order = {
    id: 42,
    items: [{ name: 'Rice', price: 1000, qty: 1, hsn: '1006' }],
    coupon: 'SAVE10',
    subtotal: 1000,
    discount: 150,
    tax: 42.5,
    total: 892.5
  };
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, total: printed.total },
    { subtotal: 1000, discount: 150, tax: 42.5, total: 892.5 }
  );
  assert.equal(printed.rows[0].lineTax, 42.5);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice and pricing use the same HSN GST rate and totals without a coupon', () => {
  const order = { items: rice, coupon: '' };
  const billed = pricing.computeTotals(order.items, order.coupon);
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(printed.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
  assert.equal(printed.total, billed.total);
});

test('invoice and pricing apply SAVE10 before GST using the same line breakdown', () => {
  const order = {
    items: [{ ...rice[0], qty: 5 }],
    coupon: 'SAVE10'
  };
  const billed = pricing.computeTotals(order.items, order.coupon);
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: billed.discount, tax: billed.tax, total: billed.total },
    { discount: 50, tax: 22.5, total: 472.5 }
  );
  assert.deepEqual(
    { discount: printed.discount, tax: printed.tax, total: printed.total },
    { discount: billed.discount, tax: billed.tax, total: billed.total }
  );
  assert.equal(printed.rows[0].lineTax, billed.lines[0].tax);
});

test('invoice and pricing both honor an explicit gstRate', () => {
  const items = [{ ...rice[0], hsn: '1006', gstRate: 12 }];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items, coupon: '' });

  assert.equal(printed.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
  assert.equal(printed.total, billed.total);
});

test('invoice uses the same per-line GST rounding as pricing', () => {
  const items = [
    { name: 'Small item A', price: 0.05, qty: 1, gstRate: 5 },
    { name: 'Small item B', price: 0.05, qty: 1, gstRate: 5 }
  ];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items, coupon: '' });

  assert.equal(billed.tax, 0);
  assert.deepEqual(printed.rows.map(row => row.lineTax), [0, 0]);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, 0);
  assert.equal(printed.sgst, billed.sgst);
  assert.equal(printed.total, billed.total);
});
