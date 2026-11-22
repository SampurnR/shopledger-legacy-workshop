'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const coupons = require('../lib/coupons');

// Inputs are in memory; no store or db.json is involved.
test('CURRENT BEHAVIOUR: billed pricing applies the HSN slab and coupon to subtotal', function () {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }
  ];

  assert.deepEqual(pricing.computeTotals(items, 'WELCOME'), {
    subtotal: 200,
    discount: 10,
    taxable: 190,
    tax: 9.5,
    cgst: 4.75,
    sgst: 4.75,
    total: 199.5,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 200,
      discount: 10,
      taxable: 190,
      tax: 9.5,
      net: 199.5
    }]
  });
});

test('invoice figures and rendered invoice match the billed order totals and per-line GST', function () {
  const order = {
    id: 41,
    date: '2026-11-22',
    customer: 'In-memory customer',
    coupon: 'WELCOME',
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 }],
    subtotal: 640,
    discount: 32,
    tax: 30.4,
    total: 638.4
  };
  const figures = invoice.computeInvoiceFigures(order);
  const html = invoice.render(order);

  // These are the exact figures computed by pricing for the order at checkout.
  assert.deepEqual(figures, {
    subtotal: 640,
    discount: 32,
    tax: 30.4,
    cgst: 15.2,
    sgst: 15.2,
    total: 638.4,
    rows: [{
      name: 'Rice',
      sku: 'RICE-1',
      hsn: '1006',
      qty: 1,
      price: 640,
      gstPercent: 5,
      line: 640,
      lineTax: 30.4
    }]
  });
  assert.match(html, /GST Amt<\/th>/);
  assert.match(html, /5%<\/td>/);
  assert.match(html, /₹30\.40/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹638\.40/);
  assert.doesNotMatch(html, /Reconciliation Notice/);
  assert.doesNotMatch(html, /CGST<\/td>|SGST<\/td>/);
});

test('invoice does not apply an expired coupon rejected by order pricing', function () {
  const order = {
    id: 42,
    coupon: 'DIWALI20',
    items: [{ name: 'Item', price: 100, qty: 1 }]
  };

  assert.equal(coupons.validate('DIWALI20', 100).valid, false);
  assert.equal(pricing.computeTotals(order.items, 'DIWALI20').discount, 0);
  assert.equal(invoice.computeInvoiceFigures(order).discount, 0);
});

test('invoice resolves decimal gstRate the same way as order pricing', function () {
  const figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Item', price: 100, qty: 1, gstRate: 0.05 }]
  });

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
});
