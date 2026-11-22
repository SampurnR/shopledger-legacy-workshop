'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

test('invoice figures match the values billed by order pricing', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const order = {
    id: 1001,
    coupon: 'SAVE10',
    items: items,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
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
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total,
    lineGstPercent: billed.lines[0].gstPercent,
    lineTax: billed.lines[0].tax
  });
});

test('CURRENT BEHAVIOUR: order pricing applies the HSN slab and coupon to discounted taxable value', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];

  const totals = pricing.computeTotals(items, 'SAVE10');

  assert.deepEqual({
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    tax: totals.tax,
    total: totals.total,
    lineGstPercent: totals.lines[0].gstPercent
  }, {
    subtotal: 1000,
    discount: 100,
    taxable: 900,
    tax: 45,
    total: 945,
    lineGstPercent: 5
  });
});

test('invoice figures use the same HSN GST and coupon totals as order pricing', function () {
  const order = {
    id: 1001,
    coupon: 'SAVE10',
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }]
  };

  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    total: figures.total,
    lineGstPercent: figures.rows[0].gstPercent
  }, {
    subtotal: 1000,
    discount: 100,
    tax: 45,
    total: 945,
    lineGstPercent: 5
  });
});

test('printable invoice does not report a mismatch when its stored billed totals match pricing', function () {
  const order = {
    id: 1001,
    date: '01/01/2021',
    status: 'completed',
    customer: 'Walk-in',
    paymentMode: 'cash',
    coupon: 'SAVE10',
    items: [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 1000, qty: 1 }],
    subtotal: 1000,
    discount: 100,
    tax: 45,
    total: 945
  };

  const html = invoice.render(order);

  assert.doesNotMatch(html, /Invoice computed total/);
  assert.match(html, /₹945\.00/);
});
