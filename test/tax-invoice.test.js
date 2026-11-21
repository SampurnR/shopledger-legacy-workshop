var assert = require('node:assert/strict');
var test = require('node:test');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');

test('tax resolves explicit GST rates as percentages or decimal rates', function () {
  assert.equal(tax.getRateForItem({ gstRate: 12 }), 0.12);
  assert.equal(tax.getRateForItem({ gstRate: 0.05 }), 0.05);
});

test('tax resolves configured HSN slabs and uses the default for unknown HSN', function () {
  assert.equal(tax.getSlabPercent({ hsn: '1006' }), 5);
  assert.equal(tax.getSlabPercent({ hsn: '9999' }), 18);
});

test('tax splits an odd cent by rounding CGST then assigning the remainder to SGST', function () {
  assert.deepEqual(tax.splitCgstSgst(1.01), { cgst: 0.51, sgst: 0.5 });
});

test('pricing taxes discounted line values using each item GST slab', function () {
  var totals = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }
  ], 'WELCOME');

  assert.deepEqual(totals, {
    subtotal: 200,
    discount: 10,
    taxable: 190,
    tax: 9.5,
    cgst: 4.75,
    sgst: 4.75,
    total: 199.5,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 200,
      discount: 10,
      taxable: 190,
      tax: 9.5,
      net: 199.5
    }]
  });
});

test('invoice matches checkout HSN GST and coupon totals for Order #1002', function () {
  var order = {
    coupon: 'SAVE10',
    items: [
      { name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
    ]
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, cgst: figures.cgst, sgst: figures.sgst, total: figures.total },
    { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 }
  );
  assert.deepEqual(figures.rows.map(function (row) { return [row.gstPercent, row.lineTax]; }), [[5, 28.8], [5, 17.1]]);
});

test('invoice applies the checkout coupon cap and HSN slab for Order #1004', function () {
  var order = {
    coupon: 'SAVE10',
    items: [{ name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 }]
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: figures.subtotal, tax: figures.tax, discount: figures.discount, total: figures.total, gstPercent: figures.rows[0].gstPercent },
    { subtotal: 2240, tax: 104.5, discount: 150, total: 2194.5, gstPercent: 5 }
  );
});

test('invoice uses item HSN slabs without a coupon', function () {
  var order = {
    items: [
      { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
      { name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
    ]
  };
  var figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total },
    { subtotal: 200, discount: 0, tax: 17, total: 217 }
  );
  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [5, 12]);
});

test('invoice GST split assigns the rounded half to CGST and the remainder to SGST', function () {
  var figures = invoice.computeInvoiceFigures({ items: [{ name: 'Odd tax', gstRate: 10.1, price: 1, qty: 1 }] });

  assert.equal(figures.tax, 0.1);
  assert.equal(figures.cgst, 0.05);
  assert.equal(figures.sgst, 0.05);
});
