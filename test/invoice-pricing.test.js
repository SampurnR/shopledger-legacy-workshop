'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// This is the line-item shape assembled by routes/orders.js and stored on orders.
// All inputs stay in memory; these tests never load lib/store or data/db.json.
function orderLine() {
  return {
    id: 1,
    sku: 'RICE-1',
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 2
  };
}

function billedOrder(items, coupon) {
  const billed = pricing.computeTotals(items, coupon);
  return {
    items,
    coupon,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
}

test('invoice figures match the customer-billed tax breakdown and total', () => {
  const items = [orderLine()];
  const order = billedOrder(items, 'WELCOME');
  const billed = pricing.computeTotals(items, 'WELCOME');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      subtotal: figures.subtotal,
      discount: figures.discount,
      tax: figures.tax,
      cgst: figures.cgst,
      sgst: figures.sgst,
      total: figures.total
    },
    {
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      cgst: billed.cgst,
      sgst: billed.sgst,
      total: billed.total
    }
  );
});

test('order pricing applies HSN GST after its pre-tax coupon discount', () => {
  const totals = pricing.computeTotals([orderLine()], 'WELCOME');

  assert.equal(totals.subtotal, 200);
  assert.equal(totals.discount, 10);
  assert.equal(totals.taxable, 190);
  assert.equal(totals.tax, 9.5);
  assert.equal(totals.cgst, 4.75);
  assert.equal(totals.sgst, 4.75);
  assert.equal(totals.total, 199.5);
  assert.deepEqual(totals.lines[0], {
    id: 1,
    name: 'Rice',
    hsn: '1006',
    gstPercent: 5,
    gross: 200,
    discount: 10,
    taxable: 190,
    tax: 9.5,
    net: 199.5
  });
});

test('invoice uses the HSN GST rate and the same pre-tax coupon discount as order pricing', () => {
  const totals = pricing.computeTotals([orderLine()], 'WELCOME');
  const figures = invoice.computeInvoiceFigures(billedOrder([orderLine()], 'WELCOME'));

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 9.5);
  assert.equal(figures.tax, 9.5);
  assert.equal(figures.cgst, 4.75);
  assert.equal(figures.sgst, 4.75);
  assert.equal(figures.discount, 10);
  assert.equal(figures.total, 199.5);
  assert.equal(figures.tax, totals.tax);
  assert.equal(figures.discount, totals.discount);
  assert.equal(figures.total, totals.total);
});

test('invoice preserves recorded billed totals when a coupon is now inactive', () => {
  const figures = invoice.computeInvoiceFigures({
    items: [orderLine()],
    coupon: 'DIWALI20',
    subtotal: 200,
    discount: 40,
    tax: 8,
    total: 168
  });

  assert.equal(figures.subtotal, 200);
  assert.equal(figures.discount, 40);
  assert.equal(figures.tax, 8);
  assert.equal(figures.cgst, 4);
  assert.equal(figures.sgst, 4);
  assert.equal(figures.total, 168);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 8);
});

test('rendered invoice has no reconciliation warning when figures match the order ledger', () => {
  const items = [orderLine()];
  const totals = pricing.computeTotals(items, 'WELCOME');
  const html = invoice.render({
    id: 1001,
    date: '15/11/2026',
    customer: 'Walk-in',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon: 'WELCOME',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹199\.50/);
});
