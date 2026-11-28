'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

// These tests use literal in-memory orders only; they do not load lib/store.js
// or read/write data/db.json.

test('CURRENT BEHAVIOUR: order pricing applies the coupon before HSN GST', function () {
  const lines = [{ id: 1, name: 'Rice', price: 1000, qty: 1, hsn: '1006' }];

  assert.deepEqual(pricing.computeTotals(lines, 'WELCOME'), {
    subtotal: 1000,
    discount: 50,
    taxable: 950,
    tax: 47.5,
    cgst: 23.75,
    sgst: 23.75,
    total: 997.5,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 1000,
      discount: 50,
      taxable: 950,
      tax: 47.5,
      net: 997.5
    }]
  });
});

test('invoice total and GST breakdown match the billed order', function () {
  const order = {
    coupon: 'WELCOME',
    subtotal: 640,
    discount: 32,
    tax: 30.4,
    total: 638.4,
    items: [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 }]
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    lineGstPercent: figures.rows[0].gstPercent,
    lineTax: figures.rows[0].lineTax
  }, {
    subtotal: order.subtotal,
    discount: order.discount,
    tax: order.tax,
    cgst: 15.2,
    sgst: 15.2,
    total: order.total,
    lineGstPercent: 5,
    lineTax: 30.4
  });
  assert.equal(figures.lineTaxBreakdownAvailable, true);
});

test('invoice does not present reconstructed line GST when it conflicts with saved tax', function () {
  const order = {
    subtotal: 200,
    discount: 0,
    tax: 20,
    total: 220,
    items: [
      { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
      { name: 'Tea', hsn: '0902', price: 100, qty: 1 }
    ]
  };
  const figures = invoice.computeInvoiceFigures(order);
  const html = invoice.render(order);

  assert.equal(figures.tax, 20);
  assert.equal(figures.cgst, 10);
  assert.equal(figures.sgst, 10);
  assert.equal(figures.total, 220);
  assert.equal(figures.lineTaxBreakdownAvailable, false);
  assert.equal(figures.rows[0].lineTax, null);
  assert.equal(figures.rows[1].lineTax, null);
  assert.match(html, /Line-level GST could not be reconstructed/);
});

test('invoice does not present line GST when the saved subtotal differs from item gross', function () {
  const result = invoice.computeInvoiceFigures({
    subtotal: 110,
    discount: 0,
    tax: 5,
    total: 115,
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  });

  assert.equal(result.subtotal, 110);
  assert.equal(result.tax, 5);
  assert.equal(result.total, 115);
  assert.equal(result.lineTaxBreakdownAvailable, false);
  assert.equal(result.rows[0].lineTax, null);
});

test('invoice warns when saved total differs from saved subtotal, discount, and tax', function () {
  const html = invoice.render({
    id: 3,
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 110,
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  });

  assert.match(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice subtotal, discount and GST total/);
  assert.match(html, /differs from recorded order total/);
  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*110\.00/);
});

test('invoice uses the HSN slab when gstRate is absent', function () {
  const result = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 1000, qty: 1 }]
  });

  assert.equal(result.subtotal, 1000);
  assert.equal(result.tax, 50);
  assert.equal(result.cgst, 25);
  assert.equal(result.sgst, 25);
  assert.equal(result.total, 1050);
  assert.equal(result.rows[0].gstPercent, 5);
});

test('invoice uses the recorded WELCOME discount and taxes the discounted HSN amount', function () {
  const result = invoice.computeInvoiceFigures({
    coupon: 'WELCOME',
    subtotal: 1000,
    discount: 50,
    tax: 47.5,
    total: 997.5,
    items: [{ name: 'Rice', hsn: '1006', price: 1000, qty: 1 }]
  });

  assert.equal(result.tax, 47.5);
  assert.equal(result.discount, 50);
  assert.equal(result.total, 997.5);
});

test('invoice preserves the saved zero discount below FLAT50 minimum', function () {
  const result = invoice.computeInvoiceFigures({
    coupon: 'FLAT50',
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105,
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  });

  assert.equal(result.discount, 0);
  assert.equal(result.tax, 5);
  assert.equal(result.total, 105);
});

test('invoice preserves a recorded discount after the coupon becomes inactive', function () {
  const result = invoice.computeInvoiceFigures({
    coupon: 'DIWALI20',
    subtotal: 2000,
    discount: 250,
    tax: 87.5,
    total: 1837.5,
    items: [{ name: 'Rice', hsn: '1006', price: 2000, qty: 1 }]
  });

  assert.equal(result.tax, 87.5);
  assert.equal(result.discount, 250);
  assert.equal(result.total, 1837.5);
});

test('invoice preserves the recorded capped SAVE10 discount', function () {
  const result = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    subtotal: 2000,
    discount: 150,
    tax: 92.5,
    total: 1942.5,
    items: [{ name: 'Rice', hsn: '1006', price: 2000, qty: 1 }]
  });

  assert.equal(result.discount, 150);
  assert.equal(result.tax, 92.5);
  assert.equal(result.total, 1942.5);
});

test('invoice HTML displays separate CGST and SGST amounts', function () {
  const html = invoice.render({
    id: 1,
    date: '01/01/2022',
    customer: 'Walk-in',
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  });

  assert.match(html, /<tr><td>CGST<\/td><td class="r">[^<]*2\.50<\/td><\/tr>/);
  assert.match(html, /<tr><td>SGST<\/td><td class="r">[^<]*2\.50<\/td><\/tr>/);
});
