'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const coupons = require('../lib/coupons');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

test('invoice uses the order-side HSN slab for line GST', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(printed.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(printed.rows[0].lineTax, billed.lines[0].tax);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
  assert.equal(printed.total, billed.total);
});

test('invoice applies SAVE10 cap and post-discount HSN GST like order pricing', function () {
  const items = [{ id: 2, name: 'Rice', sku: 'RICE-2', hsn: '1006', price: 2000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(printed.discount, 150);
  assert.equal(printed.tax, 92.5);
  assert.equal(printed.total, 1942.5);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.rows[0].lineTax, 92.5);
  assert.equal(printed.total, billed.total);
});

test('invoice applies FLAT50 before GST like order pricing', function () {
  const items = [{ id: 3, name: 'Other', sku: 'OTH-1', hsn: '9999', price: 400, qty: 1 }];
  const billed = pricing.computeTotals(items, 'FLAT50');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: 'FLAT50' });

  assert.equal(printed.discount, 50);
  assert.equal(printed.tax, 63);
  assert.equal(printed.total, 413);
  assert.equal(printed.total, billed.total);
});

test('invoice does not apply an inactive coupon', function () {
  const items = [{ id: 4, name: 'Other', sku: 'OTH-2', hsn: '9999', price: 1000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'DIWALI20');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: 'DIWALI20' });

  assert.equal(coupons.validate('DIWALI20', 1000).valid, false);
  assert.equal(printed.discount, 0);
  assert.equal(printed.total, 1180);
  assert.equal(printed.total, billed.total);
});

test('invoice totals and full GST breakdown match the billed pricing calculation', function () {
  const items = [{ id: 5, name: 'Rice', sku: 'RICE-5', hsn: '1006', price: 2000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual(
    {
      subtotal: printed.subtotal,
      discount: printed.discount,
      tax: printed.tax,
      cgst: printed.cgst,
      sgst: printed.sgst,
      total: printed.total,
      gstPercent: printed.rows[0].gstPercent,
      lineTax: printed.rows[0].lineTax
    },
    {
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      cgst: billed.cgst,
      sgst: billed.sgst,
      total: billed.total,
      gstPercent: billed.lines[0].gstPercent,
      lineTax: billed.lines[0].tax
    }
  );
});
