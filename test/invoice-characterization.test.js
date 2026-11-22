'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const coupons = require('../lib/coupons');

test('invoice figures match HSN GST and capped SAVE10 order pricing', function () {
  // These fields match the item shape saved by POST /api/orders: HSN is kept,
  // while gstRate is not copied onto the order line.
  const items = [
    { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, name: 'Tea', sku: 'BEV-001', hsn: '0902', price: 1000, qty: 1 }
  ];
  const order = {
    id: 1001,
    items: items,
    coupon: 'SAVE10',
    subtotal: 2000,
    discount: 150,
    tax: 212.75,
    total: 2062.75
  };

  const billed = pricing.computeTotals(items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.subtotal, 2000);
  assert.equal(billed.discount, 150); // SAVE10's configured maximum
  assert.equal(billed.tax, 212.75);
  assert.equal(billed.cgst, 106.38);
  assert.equal(billed.sgst, 106.37);
  assert.equal(billed.total, 2062.75);
  assert.deepEqual(billed.lines.map(function (line) { return line.gstPercent; }), [5, 18]);

  assert.equal(invoiceFigures.subtotal, 2000);
  assert.equal(invoiceFigures.discount, 150);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
  assert.deepEqual(invoiceFigures.rows.map(function (row) { return row.gstPercent; }), [5, 18]);
  assert.deepEqual(invoiceFigures.rows.map(function (row) { return row.lineTax; }), [46.25, 166.5]);
});

test('invoice preserves stored billing amounts for a historical coupon that is now inactive', function () {
  const items = [
    { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 1000, qty: 1 }
  ];
  const order = {
    items: items,
    coupon: 'DIWALI20',
    subtotal: 1000,
    discount: 200,
    tax: 40,
    total: 840
  };

  assert.equal(coupons.validate(order.coupon, 1000).valid, false);
  assert.equal(pricing.computeTotals(items, order.coupon).discount, 0);

  const invoiceFigures = invoice.computeInvoiceFigures(order);
  assert.equal(invoiceFigures.discount, 200); // Use the discount recorded when the order was billed.
  assert.equal(invoiceFigures.tax, 40);
  assert.equal(invoiceFigures.total, 840);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.rows[0].lineTax, 40);
});

test('CURRENT BEHAVIOUR: a one-paise GST amount rounds wholly into CGST', function () {
  const billed = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 0.1, qty: 1 }
  ], '');

  assert.equal(billed.tax, 0.01);
  assert.equal(billed.cgst, 0.01);
  assert.equal(billed.sgst, 0);
});

test('invoice figures match the totals and HSN GST used to bill the order', function () {
  const items = [
    { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 1000, qty: 1 }
  ];
  const billed = pricing.computeTotals(items, '');
  const order = {
    items: items,
    coupon: '',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };

  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: invoiceFigures.subtotal,
    discount: invoiceFigures.discount,
    tax: invoiceFigures.tax,
    cgst: invoiceFigures.cgst,
    sgst: invoiceFigures.sgst,
    total: invoiceFigures.total,
    gstPercent: invoiceFigures.rows[0].gstPercent
  }, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total,
    gstPercent: billed.lines[0].gstPercent
  });
});
