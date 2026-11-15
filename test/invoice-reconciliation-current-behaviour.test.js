var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function item(id, name, hsn, price, qty) {
  return {
    id: id,
    sku: 'SKU-' + id,
    name: name,
    hsn: hsn,
    price: price,
    qty: qty
  };
}

function order(id, items, coupon, total, tax) {
  return {
    id: id,
    date: '05/01/2022',
    customer: 'Fixture Customer',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: items.reduce(function (sum, it) { return sum + it.price * it.qty; }, 0),
    discount: coupon === 'SAVE10' ? (id === 1004 ? 150 : 102) : 0,
    tax: tax,
    total: total
  };
}

var order1001 = order(1001, [
  item(8, 'Assam CTC Masala Chai 250g', '0902', 140, 2),
  item(2, 'Unpolished Toor Dal 1kg', '0713', 165, 2)
], '', 676.90, 66.90);

var order1002 = order(1002, [
  item(1, 'Indrayani Basmati Rice 5kg', '1006', 640, 1),
  item(4, 'Cold-Pressed Sunflower Oil 1L', '1512', 190, 2)
], 'SAVE10', 963.90, 45.90);

var order1004 = order(1004, [
  item(5, 'Cold-Pressed Groundnut Oil 5L', '1508', 1120, 2)
], 'SAVE10', 2194.50, 104.50);

var order1007 = order(1007, [
  item(6, 'A2 Gir Cow Ghee 500ml', '0405', 450, 2),
  item(4, 'Cold-Pressed Sunflower Oil 1L', '1512', 190, 2)
], '', 1407.00, 127.00);

var order1008 = order(1008, [
  item(8, 'Assam CTC Masala Chai 250g', '0902', 140, 1),
  item(12, 'Kokum Sherbet Concentrate 750ml', '2106', 180, 2)
], '', 590.00, 90.00);

test('CURRENT BEHAVIOUR: pricing applies HSN GST slabs and apportions SAVE10 across discounted lines', function () {
  var result = pricing.computeTotals(order1002.items, order1002.coupon);

  assert.deepEqual({
    subtotal: result.subtotal,
    discount: result.discount,
    taxable: result.taxable,
    tax: result.tax,
    total: result.total,
    rates: result.lines.map(function (line) { return line.gstPercent; })
  }, {
    subtotal: 1020,
    discount: 102,
    taxable: 918,
    tax: 45.90,
    total: 963.90,
    rates: [5, 5]
  });
});

test('invoice matches checkout pricing for mixed-HSN SAVE10 orders', function () {
  var checkout = pricing.computeTotals(order1002.items, order1002.coupon);
  var printed = invoice.computeInvoiceFigures(order1002);

  assert.deepEqual({
    discount: printed.discount,
    tax: printed.tax,
    total: printed.total,
    rates: printed.rows.map(function (row) { return row.gstPercent; })
  }, {
    discount: checkout.discount,
    tax: checkout.tax,
    total: checkout.total,
    rates: checkout.lines.map(function (line) { return line.gstPercent; })
  });
});

test('invoice resolves each line GST rate from its HSN slab', function () {
  var result = invoice.computeInvoiceFigures(order1001);

  assert.deepEqual({
    discount: result.discount,
    tax: result.tax,
    total: result.total,
    rates: result.rows.map(function (row) { return row.gstPercent; })
  }, {
    discount: 0,
    tax: 66.90,
    total: 676.90,
    rates: [18, 5]
  });
});

test('invoice applies SAVE10 to subtotal and respects its max discount cap', function () {
  var result = invoice.computeInvoiceFigures(order1002);

  assert.deepEqual({
    discount: result.discount,
    tax: result.tax,
    total: result.total,
    rates: result.rows.map(function (row) { return row.gstPercent; })
  }, {
    discount: 102,
    tax: 45.90,
    total: 963.90,
    rates: [5, 5]
  });
});

test('invoice applies the capped SAVE10 discount and 5% GST to groundnut oil', function () {
  var result = invoice.computeInvoiceFigures(order1004);

  assert.deepEqual({
    discount: result.discount,
    tax: result.tax,
    total: result.total,
    rates: result.rows.map(function (row) { return row.gstPercent; })
  }, {
    discount: 150,
    tax: 104.50,
    total: 2194.50,
    rates: [5]
  });
});

test('GST reconciliation matches all eight in-memory orders after invoice pricing is aligned', function () {
  var orders = [
    order1001,
    order1002,
    order(1003, [item(7, 'Pasteurized Table Butter 500g', '0405', 260, 1), item(8, 'Assam CTC Masala Chai 250g', '0902', 140, 1)], 'FLAT50', 399.35, 49.35),
    order1004,
    order(1005, [item(1, 'Indrayani Basmati Rice 5kg', '1006', 640, 1), item(12, 'Kokum Sherbet Concentrate 750ml', '2106', 180, 2)], 'FLAT50', 1041.96, 91.96),
    order(1006, [item(6, 'A2 Gir Cow Ghee 500ml', '0405', 450, 2), item(9, 'Filter Coffee Decoction Blend 500g', '0901', 310, 1)], 'WELCOME', 1305.11, 155.61),
    order1007,
    order1008
  ];

  var result = reports.getGstReconciliation({ orders: orders });

  assert.equal(result.totalChecked, 8);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows.filter(function (row) { return row.matched; }).map(function (row) { return row.orderId; }).join(','), '1001,1002,1003,1004,1005,1006,1007,1008');
});
