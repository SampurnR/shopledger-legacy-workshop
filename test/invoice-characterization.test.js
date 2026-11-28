'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const coupons = require('../lib/coupons');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function item(name, hsn, price) {
  return {
    id: 1,
    sku: 'TEST-001',
    name: name,
    hsn: hsn,
    price: price,
    qty: 1
  };
}

function compareCheckoutAndInvoice(items, coupon, orderId) {
  const checkout = pricing.computeTotals(items, coupon || '');
  const invoiceFigures = invoice.computeInvoiceFigures({
    id: orderId,
    items: items,
    coupon: coupon || '',
    total: checkout.total
  });
  return { checkout, invoiceFigures };
}

test('Order #1002 SAVE10 invoice figures match checkout figures', function () {
  const result = compareCheckoutAndInvoice([
    item('Rice and provisions', '1006', 1020)
  ], 'SAVE10', 1002);

  assert.deepEqual(
    {
      subtotal: result.checkout.subtotal,
      discount: result.checkout.discount,
      tax: result.checkout.tax,
      total: result.checkout.total
    },
    { subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 }
  );
  assert.deepEqual(
    {
      discount: result.invoiceFigures.discount,
      tax: result.invoiceFigures.tax,
      total: result.invoiceFigures.total
    },
    { discount: 102, tax: 45.9, total: 963.9 }
  );
});

test('Order #1004 SAVE10 invoice preserves the ₹150 maximum discount', function () {
  const items = [item('Packaged goods', '0902', 2240)];
  const result = compareCheckoutAndInvoice(items, 'SAVE10', 1004);

  assert.equal(coupons.calculateDiscount(2240, 'SAVE10'), 150);
  assert.equal(result.checkout.discount, 150);
  assert.equal(result.invoiceFigures.discount, 150);
  assert.equal(result.invoiceFigures.tax, 376.2);
  assert.equal(result.invoiceFigures.total, 2466.2);
});

test('Order #1001-style invoice uses the 5% HSN slab', function () {
  const result = compareCheckoutAndInvoice([
    item('Rice', '1006', 100)
  ], '', 1001);

  assert.equal(result.checkout.lines[0].gstPercent, 5);
  assert.equal(result.checkout.tax, 5);
  assert.equal(result.invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(result.invoiceFigures.tax, 5);
  assert.equal(result.invoiceFigures.total, result.checkout.total);
});

test('Order #1007-style invoice uses the 12% HSN slab', function () {
  const result = compareCheckoutAndInvoice([
    item('Ghee', '0405', 100)
  ], '', 1007);

  assert.equal(result.checkout.lines[0].gstPercent, 12);
  assert.equal(result.checkout.tax, 12);
  assert.equal(result.invoiceFigures.rows[0].gstPercent, 12);
  assert.equal(result.invoiceFigures.tax, 12);
  assert.equal(result.invoiceFigures.total, result.checkout.total);
});

test('Order #1008-style 18% HSN items without a coupon match between checkout and invoice', function () {
  const result = compareCheckoutAndInvoice([
    item('Packaged tea', '0902', 100)
  ], '', 1008);

  assert.equal(result.checkout.tax, 18);
  assert.equal(result.invoiceFigures.tax, 18);
  assert.equal(result.checkout.cgst, result.invoiceFigures.cgst);
  assert.equal(result.checkout.sgst, result.invoiceFigures.sgst);
  assert.equal(result.checkout.total, result.invoiceFigures.total);
});
