'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function makeStoredOrder(items, coupon) {
  const totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 1,
    date: '01/01/2025',
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

test('invoice uses the HSN rate and matches billed GST and total', function () {
  const items = [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const order = makeStoredOrder(items, '');
  const ledgerFigures = pricing.computeTotals(items, '');
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(ledgerFigures.lines[0].gstPercent, 5);
  assert.equal(order.tax, 5);
  assert.equal(order.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.rows[0].lineTax, 5);
  assert.equal(invoiceFigures.tax, order.tax);
  assert.equal(invoiceFigures.cgst, 2.5);
  assert.equal(invoiceFigures.sgst, 2.5);
  assert.equal(invoiceFigures.total, order.total);

  const html = invoice.render(order);
  assert.match(html, /<td>CGST<\/td>/);
  assert.match(html, /<td>SGST<\/td>/);
  assert.match(html, /5%/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice uses the capped coupon discount and post-discount HSN tax', function () {
  const items = [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 6000, qty: 1 }];
  const order = makeStoredOrder(items, 'SAVE10');
  const ledgerFigures = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(ledgerFigures.discount, 150);
  assert.equal(ledgerFigures.tax, 292.5);
  assert.equal(order.total, 6142.5);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.rows[0].lineTax, ledgerFigures.lines[0].tax);
  assert.equal(invoiceFigures.discount, order.discount);
  assert.equal(invoiceFigures.tax, order.tax);
  assert.equal(invoiceFigures.cgst, ledgerFigures.cgst);
  assert.equal(invoiceFigures.sgst, ledgerFigures.sgst);
  assert.equal(invoiceFigures.total, order.total);
});
