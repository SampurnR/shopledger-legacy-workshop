'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

test('invoice uses the billed order GST, coupon, and total calculations', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];
  const order = { coupon: 'SAVE10', items: items };
  const billed = pricing.computeTotals(items, order.coupon);
  const invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.cgst, billed.cgst);
  assert.equal(invoiced.sgst, billed.sgst);
  assert.equal(invoiced.total, billed.total);
  assert.equal(invoiced.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(invoiced.rows[0].lineTax, billed.lines[0].tax);
  assert.equal(invoiced.rows[0].line, billed.lines[0].gross);
});

test('invoice renders the same total as the recorded order', function () {
  const order = {
    id: 42,
    total: 1050,
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }]
  };

  const billed = pricing.computeTotals(order.items, '');
  const invoiced = invoice.computeInvoiceFigures(order);
  assert.equal(billed.total, order.total);
  assert.equal(invoiced.total, billed.total);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice reconciliation notice is retained for a genuinely different order total', function () {
  const html = invoice.render({
    id: 42,
    date: '2026-11-21',
    total: 1060,
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }]
  });

  assert.match(html, /Invoice computed total \(₹1050\.00\)/);
  assert.match(html, /Order Ledger recorded total \(₹1060\.00\)/);
  assert.match(html, /by -₹10\.00/);
});
