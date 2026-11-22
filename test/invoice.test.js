'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function line(id, name, hsn, price, qty) {
  return { id, name, sku: 'SKU-' + id, hsn, price, qty };
}

function checkoutOrder(id, items, coupon) {
  const totals = pricing.computeTotals(items, coupon || '');
  return {
    id,
    date: '15/03/2022',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice for #1002 uses checkout HSN rates and SAVE10 totals', function () {
  const items = [
    line(1, 'Indrayani Basmati Rice 5kg', '1006', 640, 1),
    line(4, 'Cold-Pressed Sunflower Oil 1L', '1512', 190, 2)
  ];
  const order = checkoutOrder(1002, items, 'SAVE10');
  const billed = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, cgst: printed.cgst, sgst: printed.sgst, total: printed.total },
    { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 }
  );
  assert.deepEqual(printed.rows.map(function (row) { return row.gstPercent; }), [5, 5]);

  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹963\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice applies SAVE10 discount cap and tax using checkout calculation', function () {
  const items = [line(1, 'Rice', '1006', 1120, 2)];
  const order = checkoutOrder(1004, items, 'SAVE10');
  const billed = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: billed.discount, tax: billed.tax, total: billed.total },
    { discount: 150, tax: 104.5, total: 2194.5 }
  );
  assert.deepEqual(
    { discount: printed.discount, tax: printed.tax, total: printed.total },
    { discount: 150, tax: 104.5, total: 2194.5 }
  );
});

test('CORRECT BEHAVIOUR: reprinting preserves the recorded discount for an expired coupon', function () {
  const items = [line(8, 'Packaged Tea', '0902', 500, 2)];
  const order = {
    ...checkoutOrder(1009, items, ''),
    coupon: 'DIWALI20',
    discount: 200,
    tax: 144,
    total: 944
  };
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, cgst: printed.cgst, sgst: printed.sgst, total: printed.total },
    { subtotal: 1000, discount: 200, tax: 144, cgst: 72, sgst: 72, total: 944 }
  );
});

test('invoice uses the configured 12% HSN slab and splits GST', function () {
  const items = [line(7, 'Table Butter', '0405', 260, 1)];
  const order = checkoutOrder(1007, items, '');
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { tax: billed.tax, total: billed.total },
    { tax: 31.2, total: 291.2 }
  );
  assert.deepEqual(
    { gstPercent: printed.rows[0].gstPercent, tax: printed.tax, cgst: printed.cgst, sgst: printed.sgst, total: printed.total },
    { gstPercent: 12, tax: 31.2, cgst: 15.6, sgst: 15.6, total: 291.2 }
  );
});

test('invoice and checkout totals match for a no-coupon HSN 18% line', function () {
  const items = [line(8, 'Packaged Tea', '0902', 140, 1)];
  const order = checkoutOrder(1008, items, '');
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { billedTax: billed.tax, billedTotal: billed.total, invoiceTax: printed.tax, invoiceTotal: printed.total },
    { billedTax: 25.2, billedTotal: 165.2, invoiceTax: 25.2, invoiceTotal: 165.2 }
  );
});

test('GST reconciliation matches invoice figures to checkout for all eight representative orders', function () {
  const orders = [
    checkoutOrder(1001, [line(8, 'Tea', '0902', 140, 2), line(2, 'Dal', '0713', 165, 2)], ''),
    checkoutOrder(1002, [line(1, 'Rice', '1006', 640, 1), line(4, 'Oil', '1512', 190, 2)], 'SAVE10'),
    checkoutOrder(1003, [line(7, 'Butter', '0405', 260, 1), line(8, 'Tea', '0902', 140, 1)], 'FLAT50'),
    checkoutOrder(1004, [line(5, 'Groundnut Oil', '1508', 1120, 2)], 'SAVE10'),
    checkoutOrder(1005, [line(1, 'Rice', '1006', 640, 1), line(12, 'Syrup', '2106', 180, 2)], 'FLAT50'),
    checkoutOrder(1006, [line(7, 'Ghee', '0405', 450, 2), line(9, 'Coffee', '0901', 310, 1)], 'WELCOME'),
    checkoutOrder(1007, [line(7, 'Ghee', '0405', 450, 2), line(4, 'Sunflower Oil', '1512', 190, 2)], ''),
    checkoutOrder(1008, [line(8, 'Tea', '0902', 140, 1), line(12, 'Syrup', '2106', 180, 2)], '')
  ];

  const result = reports.getGstReconciliation({ orders });

  assert.equal(result.totalChecked, 8);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows.find(function (row) { return row.orderId === 1008; }).matched, true);
  assert.deepEqual(
    result.rows.filter(function (row) { return row.matched; }).map(function (row) { return row.orderId; }),
    [1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008]
  );
});
