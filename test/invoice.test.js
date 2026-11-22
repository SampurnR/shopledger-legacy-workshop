var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

// Saved order lines have HSN but no explicit gstRate. Keep that field absent here.
function item(name, hsn, price, qty) {
  return { name: name, hsn: hsn, price: price, qty: qty };
}

function figures(items, coupon) {
  var order = { items: items, coupon: coupon };
  return {
    printed: invoice.computeInvoiceFigures(order),
    billed: pricing.computeTotals(items, coupon)
  };
}

test('#1001 invoice matches checkout HSN GST without a coupon', function () {
  var result = figures([
    item('Assam CTC Masala Chai 250g', '0902', 140, 2),
    item('Unpolished Toor Dal 1kg', '0713', 165, 2)
  ], '');

  assert.deepEqual([result.billed.subtotal, result.billed.discount, result.billed.tax, result.billed.total], [610, 0, 66.9, 676.9]);
  assert.deepEqual([result.printed.subtotal, result.printed.discount, result.printed.tax, result.printed.cgst, result.printed.sgst, result.printed.total], [610, 0, 66.9, 33.45, 33.45, 676.9]);
  assert.deepEqual(result.printed.rows.map(function (row) { return row.gstPercent; }), [18, 5]);
  assert.deepEqual(result.printed.rows.map(function (row) { return row.lineTax; }), [50.4, 16.5]);
});

test('#1002 SAVE10 invoice matches checkout tax after discount', function () {
  var result = figures([
    item('Indrayani Basmati Rice 5kg', '1006', 640, 1),
    item('Cold-Pressed Sunflower Oil 1L', '1512', 190, 2)
  ], 'SAVE10');

  assert.deepEqual([result.billed.subtotal, result.billed.discount, result.billed.tax, result.billed.total], [1020, 102, 45.9, 963.9]);
  assert.deepEqual([result.printed.subtotal, result.printed.discount, result.printed.tax, result.printed.cgst, result.printed.sgst, result.printed.total], [1020, 102, 45.9, 22.95, 22.95, 963.9]);
  assert.deepEqual(result.printed.rows.map(function (row) { return row.gstPercent; }), [5, 5]);
  assert.deepEqual(result.printed.rows.map(function (row) { return row.lineTax; }), [28.8, 17.1]);
});

test('#1004 SAVE10 invoice matches checkout cap and 5% HSN', function () {
  var result = figures([
    item('Cold-Pressed Groundnut Oil 5L', '1508', 1120, 2)
  ], 'SAVE10');

  assert.deepEqual([result.billed.subtotal, result.billed.discount, result.billed.tax, result.billed.total], [2240, 150, 104.5, 2194.5]);
  assert.deepEqual([result.printed.subtotal, result.printed.discount, result.printed.tax, result.printed.cgst, result.printed.sgst, result.printed.total], [2240, 150, 104.5, 52.25, 52.25, 2194.5]);
  assert.equal(result.printed.rows[0].gstPercent, 5);
});

test('CURRENT BEHAVIOUR: #1008 all-18% invoice and checkout agree without a coupon', function () {
  var result = figures([
    item('Assam CTC Masala Chai 250g', '0902', 140, 1),
    item('Kokum Sherbet Concentrate 750ml', '2106', 180, 2)
  ], '');

  assert.deepEqual([result.billed.subtotal, result.billed.discount, result.billed.tax, result.billed.total], [500, 0, 90, 590]);
  assert.deepEqual([result.printed.subtotal, result.printed.discount, result.printed.tax, result.printed.cgst, result.printed.sgst, result.printed.total], [500, 0, 90, 45, 45, 590]);
  assert.deepEqual(result.printed.rows.map(function (row) { return row.gstPercent; }), [18, 18]);
});

test('invoice matches checkout HSN GST and capped SAVE10 discount', function () {
  var result = figures([
    item('Cold-Pressed Groundnut Oil 5L', '1508', 1120, 2)
  ], 'SAVE10');

  assert.deepEqual(
    [result.printed.subtotal, result.printed.discount, result.printed.tax, result.printed.total],
    [result.billed.subtotal, result.billed.discount, result.billed.tax, result.billed.total]
  );
  assert.deepEqual([result.printed.rows[0].gstPercent, result.printed.rows[0].lineTax], [5, 104.5]);
});
