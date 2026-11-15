var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('invoice matches checkout GST for Order #1001 with 18% and 5% HSN items', function () {
  var items = [
    { id: 8, name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 2 },
    { id: 2, name: 'Unpolished Toor Dal 1kg', hsn: '0713', price: 165, qty: 2 }
  ];
  var checkout = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ id: 1001, items: items, coupon: '' });

  assert.equal(checkout.tax, 66.9);
  assert.deepEqual(printed.rows.map(function (row) { return row.gstPercent; }), [18, 5]);
  assert.equal(printed.tax, checkout.tax);
  assert.equal(printed.total, checkout.total);
});

test('invoice matches checkout coupon, GST, and total for Order #1002 (Anil Kulkarni)', function () {
  var items = [
    { id: 1, name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
    { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
  ];
  var checkout = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ id: 1002, items: items, coupon: 'SAVE10' });

  assert.equal(checkout.discount, 102);
  assert.equal(checkout.tax, 45.9);
  assert.equal(checkout.total, 963.9);
  assert.deepEqual(printed.rows.map(function (row) { return row.gstPercent; }), [5, 5]);
  assert.equal(printed.discount, checkout.discount);
  assert.equal(printed.tax, checkout.tax);
  assert.equal(printed.total, checkout.total);
});

test('invoice applies SAVE10 ₹150 cap to Order #1004 and matches checkout', function () {
  var items = [{ id: 5, name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }];
  var checkout = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ id: 1004, items: items, coupon: 'SAVE10' });

  assert.equal(checkout.discount, 150);
  assert.equal(checkout.tax, 104.5);
  assert.equal(checkout.total, 2194.5);
  assert.equal(printed.discount, checkout.discount);
  assert.equal(printed.tax, checkout.tax);
  assert.equal(printed.total, checkout.total);
});

test('invoice matches checkout GST for Order #1007 with 12% and 5% HSN items', function () {
  var items = [
    { id: 6, name: 'A2 Gir Cow Ghee 500ml', hsn: '0405', price: 450, qty: 2 },
    { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
  ];
  var checkout = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ id: 1007, items: items, coupon: '' });

  assert.equal(checkout.tax, 127);
  assert.deepEqual(printed.rows.map(function (row) { return row.gstPercent; }), [12, 5]);
  assert.equal(printed.tax, checkout.tax);
  assert.equal(printed.total, checkout.total);
});

test('invoice and checkout agree for Order #1008 with only 18% items and no coupon', function () {
  var items = [
    { id: 8, name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 1 },
    { id: 12, name: 'Kokum Sherbet Concentrate 750ml', hsn: '2106', price: 180, qty: 2 }
  ];
  var checkout = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ id: 1008, items: items, coupon: '' });

  assert.equal(checkout.tax, 90);
  assert.equal(printed.tax, checkout.tax);
  assert.equal(printed.total, checkout.total);
});
