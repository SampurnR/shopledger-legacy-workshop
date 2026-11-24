'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const coupons = require('../lib/coupons');
const invoice = require('../lib/invoice');

// In-memory order line items only; no test reads or writes data/db.json.

function assertInvoiceMatchesPricing(items, coupon) {
  const billed = pricing.computeTotals(items, coupon);
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: coupon });

  assert.deepEqual({
    subtotal: printed.subtotal,
    discount: printed.discount,
    tax: printed.tax,
    cgst: printed.cgst,
    sgst: printed.sgst,
    total: printed.total
  }, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total
  });
  assert.deepEqual(printed.rows.map(function (row) { return row.lineTax; }),
    billed.lines.map(function (line) { return line.tax; }));

  return { billed: billed, printed: printed };
}

test('invoice GST breakdown and total match the mixed-HSN order pricing', function () {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 2000, qty: 1 }
  ];
  const coupon = 'SAVE10';
  const result = assertInvoiceMatchesPricing(items, coupon);
  assert.equal(result.printed.discount, 150);
  assert.equal(result.printed.tax, 338.93);
  assert.equal(result.printed.total, 2288.93);
});

test('invoice uses the HSN slab applied by order pricing', function () {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ];

  const result = assertInvoiceMatchesPricing(items, '');
  assert.equal(result.printed.tax, 5);
  assert.equal(result.printed.total, 105);
});

test('invoice applies a flat coupon before calculating GST, as order pricing does', function () {
  const items = [
    { id: 1, name: 'Tea', hsn: '0902', gstRate: 18, price: 400, qty: 1 }
  ];

  const result = assertInvoiceMatchesPricing(items, 'FLAT50');
  assert.equal(result.printed.discount, 50);
  assert.equal(result.printed.tax, 63);
  assert.equal(result.printed.total, 413);
});

test('invoice respects coupon maximum discount and GST calculation from order pricing', function () {
  const items = [
    { id: 1, name: 'Tea', hsn: '0902', gstRate: 18, price: 2000, qty: 1 }
  ];

  const result = assertInvoiceMatchesPricing(items, 'SAVE10');
  assert.equal(result.printed.discount, 150);
  assert.equal(result.printed.tax, 333);
  assert.equal(result.printed.total, 2183);
});

test('invoice does not apply an inactive coupon rejected by order coupon validation', function () {
  const items = [
    { id: 1, name: 'Tea', hsn: '0902', gstRate: 18, price: 1000, qty: 1 }
  ];

  const validation = coupons.validate('DIWALI20', 1000);
  const result = assertInvoiceMatchesPricing(items, validation.valid ? 'DIWALI20' : '');

  assert.equal(validation.valid, false);
  assert.equal(result.printed.discount, 0);
  assert.equal(result.printed.total, 1180);
});

test('invoice renderer omits reconciliation notice when ledger and invoice totals match', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const html = invoice.render({
    id: 1,
    date: '24/11/2026',
    customer: 'Walk-in',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: '',
    total: billed.total
  });

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
