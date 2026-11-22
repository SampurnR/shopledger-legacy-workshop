'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

function totalsFor(figures) {
  return {
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total
  };
}

test('CURRENT BEHAVIOUR: order pricing applies SAVE10 to subtotal and caps its discount', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 2 }];

  const totals = pricing.computeTotals(items, 'SAVE10');

  assert.deepEqual(totalsFor(totals), {
    subtotal: 2000,
    discount: 150,
    tax: 92.5,
    cgst: 46.25,
    sgst: 46.25,
    total: 1942.5
  });
});

test('EXPECTED BEHAVIOUR: invoice GST for an HSN item matches the billed order', function () {
  const item = { id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 };
  const billed = pricing.computeTotals([item], '');
  const invoiced = invoice.computeInvoiceFigures({ items: [item], coupon: '' });

  assert.deepEqual(totalsFor(invoiced), totalsFor(billed));
  assert.equal(invoiced.rows[0].gstPercent, 5);
  assert.equal(invoiced.rows[0].lineTax, billed.lines[0].tax);
});

test('EXPECTED BEHAVIOUR: invoice applies the same coupon base and cap as the billed order', function () {
  const item = { id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 };
  const billed = pricing.computeTotals([item], 'SAVE10');
  const invoiced = invoice.computeInvoiceFigures({ items: [item], coupon: 'SAVE10' });

  assert.deepEqual(totalsFor(invoiced), totalsFor(billed));
  assert.equal(invoiced.rows[0].lineDiscount, billed.lines[0].discount);
  assert.equal(invoiced.rows[0].taxable, billed.lines[0].taxable);
});

test('EXPECTED BEHAVIOUR: rendered invoice has no reconciliation warning for the billed total', function () {
  const item = { id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 };
  const billed = pricing.computeTotals([item], 'SAVE10');
  const html = invoice.render({
    id: 1001,
    date: '22/11/2026',
    customer: 'Test Customer',
    paymentMode: 'cash',
    items: [item],
    coupon: 'SAVE10',
    total: billed.total
  });

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹945\.00/);
});
