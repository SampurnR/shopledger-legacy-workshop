'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function item(id, hsn, price, qty) {
  return { id, name: 'Fixture item ' + id, sku: 'FIX-' + id, hsn, price, qty };
}

function order(id, items, coupon, checkoutTotals) {
  return {
    id,
    date: '01/01/2022',
    customer: 'In-memory fixture',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon: coupon || '',
    subtotal: checkoutTotals.subtotal,
    discount: checkoutTotals.discount,
    tax: checkoutTotals.tax,
    total: checkoutTotals.total
  };
}

test('CORRECT BEHAVIOUR — printed invoice totals and GST breakdown match checkout calculations', function () {
  const items = [item(9, '1006', 1020, 1)];
  const checkout = pricing.computeTotals(items, 'SAVE10');
  const recordedOrder = order(1002, items, 'SAVE10', checkout);
  const printed = invoice.computeInvoiceFigures(recordedOrder);

  assert.equal(printed.subtotal, checkout.subtotal);
  assert.equal(printed.discount, checkout.discount);
  assert.equal(printed.tax, checkout.tax);
  assert.equal(printed.cgst, checkout.cgst);
  assert.equal(printed.sgst, checkout.sgst);
  assert.equal(printed.total, checkout.total);
  assert.deepEqual(printed.rows.map(function (line) {
    return { gstPercent: line.gstPercent, lineTax: line.lineTax };
  }), [{ gstPercent: 5, lineTax: 45.9 }]);
  const html = invoice.render(recordedOrder);
  assert.match(html, /₹45\.90/);
  assert.match(html, /₹963\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('INVOICE BEHAVIOUR — SAVE10 HSN 1006 figures match checkout in the reported amounts', function () {
  const items = [item(1, '1006', 1020, 1)];
  const checkout = pricing.computeTotals(items, 'SAVE10');
  const recordedOrder = order(1002, items, 'SAVE10', checkout);
  const printed = invoice.computeInvoiceFigures(recordedOrder);

  assert.equal(checkout.subtotal, 1020);
  assert.equal(checkout.discount, 102);
  assert.equal(checkout.tax, 45.9);
  assert.equal(checkout.total, 963.9);
  assert.equal(printed.tax, 45.9);
  assert.equal(printed.discount, 102);
  assert.equal(printed.total, 963.9);
});

test('INVOICE BEHAVIOUR — SAVE10 discount honors the configured cap and taxes discounted value', function () {
  const items = [item(2, '0902', 2240, 1)];
  const checkout = pricing.computeTotals(items, 'SAVE10');
  const recordedOrder = order(1004, items, 'SAVE10', checkout);
  const printed = invoice.computeInvoiceFigures(recordedOrder);

  assert.equal(checkout.discount, 150);
  assert.equal(checkout.tax, 376.2);
  assert.equal(checkout.total, 2466.2);
  assert.equal(printed.tax, 376.2);
  assert.equal(printed.discount, 150);
  assert.equal(printed.total, 2466.2);
});

test('INVOICE BEHAVIOUR — invoice uses the HSN 5% and 12% slabs', function () {
  const rice = item(3, '1006', 100, 1);
  const ghee = item(4, '0405', 100, 1);
  const items = [rice, ghee];
  const checkout = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures(order(1007, items, '', checkout));

  assert.equal(checkout.tax, 17);
  assert.deepEqual(checkout.lines.map(function (line) { return line.gstPercent; }), [5, 12]);
  assert.equal(printed.tax, 17);
  assert.deepEqual(printed.rows.map(function (line) { return line.gstPercent; }), [5, 12]);
});

test('INVOICE BEHAVIOUR — an explicit line gstRate takes precedence over the HSN slab', function () {
  const line = Object.assign(item(5, '1006', 100, 1), { gstRate: 12 });
  const printed = invoice.computeInvoiceFigures({ items: [line], coupon: '' });

  assert.equal(printed.rows[0].gstPercent, 12);
  assert.equal(printed.tax, 12);
});

test('INVOICE BEHAVIOUR — HSN 18% with no coupon matches checkout totals', function () {
  const items = [item(6, '0902', 100, 1)];
  const checkout = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures(order(1008, items, '', checkout));

  assert.equal(checkout.tax, 18);
  assert.equal(checkout.total, 118);
  assert.equal(printed.tax, checkout.tax);
  assert.equal(printed.total, checkout.total);
});

test('INVOICE BEHAVIOUR — GST reconciliation matches invoice figures to checkout totals', function () {
  const matchingItems = [item(7, '0902', 100, 1)];
  const matchingTotals = pricing.computeTotals(matchingItems, '');
  const mismatchItems = [item(8, '1006', 1020, 1)];
  const mismatchTotals = pricing.computeTotals(mismatchItems, 'SAVE10');
  const result = reports.getGstReconciliation({
    orders: [
      order(1008, matchingItems, '', matchingTotals),
      order(1002, mismatchItems, 'SAVE10', mismatchTotals)
    ]
  });

  assert.equal(result.totalChecked, 2);
  assert.equal(result.mismatchCount, 0);
  assert.deepEqual(result.rows.map(function (row) { return row.matched; }), [true, true]);
  assert.equal(result.rows[1].invoiceTax, 45.9);
  assert.equal(result.rows[1].invoiceTotal, 963.9);
});
