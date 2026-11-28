'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

test('invoice figures match the amount and GST used when the order is billed', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 }];
  const coupon = 'SAVE10';
  const billed = pricing.computeTotals(items, coupon);
  const invoiced = invoice.computeInvoiceFigures({ items: items, coupon: coupon });

  assert.equal(invoiced.subtotal, billed.subtotal);
  assert.equal(invoiced.discount, billed.discount);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.cgst, billed.cgst);
  assert.equal(invoiced.sgst, billed.sgst);
  assert.equal(invoiced.total, billed.total);
  assert.equal(invoiced.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(invoiced.rows[0].lineTax, billed.lines[0].tax);
});
