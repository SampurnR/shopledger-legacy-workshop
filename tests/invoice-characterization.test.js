'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');
var coupons = require('../lib/coupons');
var invoice = require('../lib/invoice');

function line(id, name, hsn, price, qty) {
  return { id: id, sku: 'SKU-' + id, name: name, hsn: hsn, price: price, qty: qty };
}

function inMemoryOrder(id, customer, date, items, coupon) {
  var totals = pricing.computeTotals(items, coupon || '');
  return {
    id: id,
    customer: customer,
    date: date,
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('HSN rates resolve from item HSN for checkout', function () {
  assert.equal(tax.getSlabPercent({ hsn: '1006' }), 5);
  assert.equal(tax.getSlabPercent({ hsn: '0405' }), 12);
  assert.equal(tax.getSlabPercent({ hsn: '0902' }), 18);
  assert.equal(tax.getSlabPercent({ hsn: 'unknown' }), 18);
});

test('Invoice for Order #1002 matches capped coupon and HSN checkout GST', function () {
  var items = [
    line(1, 'Indrayani Basmati Rice 5kg', '1006', 640, 1),
    line(4, 'Cold-Pressed Sunflower Oil 1L', '1512', 190, 2)
  ];
  var order = inMemoryOrder(1002, 'Anil Kulkarni', '05/01/2022', items, 'SAVE10');
  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, total: printed.total },
    { subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 }
  );
  assert.deepEqual(printed.rows.map(function (row) { return [row.gstPercent, row.lineTax]; }), [[5, 28.8], [5, 17.1]]);
});

test('Invoice for Order #1004 matches capped SAVE10 and groundnut oil HSN GST', function () {
  var items = [line(5, 'Cold-Pressed Groundnut Oil 5L', '1508', 1120, 2)];
  var order = inMemoryOrder(1004, 'Kalyani Foods (Wholesale)', '30/01/2022', items, 'SAVE10');
  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: billed.discount, tax: billed.tax, total: billed.total },
    { discount: 150, tax: 104.5, total: 2194.5 }
  );
  assert.deepEqual(
    { discount: printed.discount, tax: printed.tax, total: printed.total },
    { discount: 150, tax: 104.5, total: 2194.5 }
  );
});

test('Invoice for Order #1001 without coupon uses each HSN slab', function () {
  var items = [
    line(8, 'Assam CTC Masala Chai 250g', '0902', 140, 2),
    line(2, 'Unpolished Toor Dal 1kg', '0713', 165, 2)
  ];
  var order = inMemoryOrder(1001, 'Meera Joshi', '28/12/2021', items, '');
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { tax: billed.tax, total: billed.total },
    { tax: 66.9, total: 676.9 }
  );
  assert.deepEqual(
    { tax: printed.tax, total: printed.total },
    { tax: 66.9, total: 676.9 }
  );
  assert.deepEqual(printed.rows.map(function (row) { return row.gstPercent; }), [18, 5]);
});

test('Invoice for Order #1007 without coupon uses 12% and 5% HSN slabs', function () {
  var items = [
    line(6, 'A2 Gir Cow Ghee 500ml', '0405', 450, 2),
    line(4, 'Cold-Pressed Sunflower Oil 1L', '1512', 190, 2)
  ];
  var order = inMemoryOrder(1007, 'Suresh Deshmukh', '04/03/2022', items, '');
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { tax: billed.tax, total: billed.total },
    { tax: 127, total: 1407 }
  );
  assert.deepEqual(
    { tax: printed.tax, total: printed.total },
    { tax: 127, total: 1407 }
  );
  assert.deepEqual(printed.rows.map(function (row) { return row.gstPercent; }), [12, 5]);
});

test('All-18% Order #1008 without coupon matches checkout totals', function () {
  var items = [
    line(8, 'Assam CTC Masala Chai 250g', '0902', 140, 1),
    line(12, 'Kokum Sherbet Concentrate 750ml', '2106', 180, 2)
  ];
  var order = inMemoryOrder(1008, 'Walk-in', '15/03/2022', items, '');
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 500, discount: 0, tax: 90, total: 590 }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, total: printed.total },
    { subtotal: 500, discount: 0, tax: 90, total: 590 }
  );
});

test('Invoice uses recorded discount for an order whose coupon is now inactive', function () {
  var items = [line(1, 'Indrayani Basmati Rice 5kg', '1006', 640, 2)];
  var order = inMemoryOrder(2001, 'Example customer', '21/11/2026', items, 'DIWALI20');
  order.discount = 250;
  order.tax = 51.5;
  order.total = 1081.5;
  var validation = coupons.validate('DIWALI20', pricing.subtotal(items));
  var printed = invoice.computeInvoiceFigures(order);

  assert.equal(validation.valid, false);
  assert.equal(printed.discount, 250);
  assert.equal(printed.tax, 51.5);
  assert.equal(printed.total, 1081.5);
});
