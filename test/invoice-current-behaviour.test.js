'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

const riceOrder = {
  id: 1,
  date: '22/11/2026',
  customer: 'In-memory customer',
  paymentMode: 'cash',
  status: 'completed',
  items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 }],
  coupon: 'WELCOME'
};

test('invoice matches checkout GST breakdown and total for HSN items with a coupon', function () {
  const checkout = pricing.computeTotals(riceOrder.items, riceOrder.coupon);
  const printed = invoice.computeInvoiceFigures({ ...riceOrder, total: checkout.total });

  assert.equal(printed.subtotal, checkout.subtotal);
  assert.equal(printed.discount, checkout.discount);
  assert.equal(printed.tax, checkout.tax);
  assert.equal(printed.cgst, checkout.cgst);
  assert.equal(printed.sgst, checkout.sgst);
  assert.equal(printed.total, checkout.total);
  assert.equal(printed.rows[0].gstPercent, checkout.lines[0].gstPercent);
  assert.equal(printed.rows[0].lineTax, checkout.lines[0].tax);
});

test('invoice uses checkout HSN GST rate for line tax and GST split', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }];
  const checkout = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, checkout.tax);
  assert.equal(printed.cgst, checkout.cgst);
  assert.equal(printed.sgst, checkout.sgst);
});

test('invoice uses the checkout coupon cap and reports the billed total without a mismatch warning', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 2000, qty: 1 }];
  const checkout = pricing.computeTotals(items, 'SAVE10');
  const order = { ...riceOrder, id: 2, items: items, coupon: 'SAVE10', total: checkout.total };
  const printed = invoice.computeInvoiceFigures(order);
  const html = invoice.render(order);

  assert.equal(printed.discount, 150);
  assert.equal(printed.tax, 92.5);
  assert.equal(printed.total, 1942.5);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹1942\.50/);
});
