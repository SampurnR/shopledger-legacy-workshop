'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const coupons = require('../lib/coupons');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// Match the line-item fields saved by routes/orders.js; orders do not store gstRate.
function makeOrder(itemInputs, couponCode) {
  const items = itemInputs.map(function (item) {
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      hsn: item.hsn,
      price: item.price,
      qty: item.qty
    };
  });
  const totals = pricing.computeTotals(items, couponCode || '');

  return {
    id: 1001,
    date: '26/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: couponCode || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice figures match the GST and total recorded by order pricing', function () {
  const order = makeOrder([
    { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ]);
  const invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(invoiced.tax, order.tax);
  assert.equal(invoiced.total, order.total);
  assert.equal(invoiced.rows[0].gstPercent, 5);
  assert.doesNotMatch(invoice.render(order), /differs from Order Ledger recorded total/);
});

test('invoice uses capped SAVE10 discount and post-discount HSN tax from order pricing', function () {
  const order = makeOrder([
    { id: 8, sku: 'BEV-001', name: 'Tea', hsn: '0902', price: 3000, qty: 1 }
  ], 'SAVE10');

  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(coupons.validate('SAVE10', order.subtotal).valid, true);
  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 513);
  assert.equal(billed.total, 3363);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.discount, billed.discount);
  assert.equal(invoiced.total, billed.total);
  assert.equal(invoiced.rows[0].lineDiscount, 150);
  assert.equal(invoiced.rows[0].taxable, 2850);
  assert.equal(invoiced.rows[0].lineTax, 513);
});

test('invoice does not apply SAVE10 below its configured minimum', function () {
  const order = makeOrder([
    { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 400, qty: 1 }
  ]);
  order.coupon = 'SAVE10';

  const invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(coupons.validate('SAVE10', order.subtotal).valid, false);
  assert.equal(invoiced.discount, 0);
  assert.equal(invoiced.tax, 20);
  assert.equal(invoiced.total, 420);
});

test('invoice does not apply inactive DIWALI20', function () {
  const order = makeOrder([
    { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 1000, qty: 1 }
  ]);
  order.coupon = 'DIWALI20';

  const invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(coupons.validate('DIWALI20', order.subtotal).valid, false);
  assert.equal(invoiced.tax, 50);
  assert.equal(invoiced.discount, 0);
  assert.equal(invoiced.total, 1050);
});

test('CURRENT BEHAVIOUR: rendered invoice shows combined GST rather than separate CGST and SGST rows', function () {
  const order = makeOrder([
    { id: 8, sku: 'BEV-001', name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);
  const html = invoice.render(order);

  assert.equal(figures.cgst, 9);
  assert.equal(figures.sgst, 9);
  assert.match(html, /CGST \+ SGST \(Total GST\)/);
  assert.doesNotMatch(html, /<td>CGST<\/td>|<td>SGST<\/td>/);
});
