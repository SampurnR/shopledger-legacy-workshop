'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const config = require('../config');

test('invoice GST matches the GST included in the billed total', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice coupon and tax breakdown matches the billed total', function () {
  const items = [{ id: 1, name: 'Item', hsn: '1006', price: 1000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice lines show the same post-discount GST bases used for billing', function () {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 500, qty: 1 }
  ];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual(invoiceFigures.rows.map(function (row) {
    return { gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), billed.lines.map(function (line) {
    return { gstPercent: line.gstPercent, lineTax: line.tax };
  }));
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
});

test('CURRENT BEHAVIOUR orders without a coupon keep their computed totals', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(billed.subtotal, 100);
  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(invoiceFigures.subtotal, billed.subtotal);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice preserves an explicit zero GST rate', function () {
  const figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Zero rated', gstRate: 0, price: 100, qty: 1 }],
    coupon: ''
  });

  assert.equal(figures.rows[0].gstPercent, 0);
  assert.equal(figures.tax, 0);
  assert.equal(figures.total, 100);
});
