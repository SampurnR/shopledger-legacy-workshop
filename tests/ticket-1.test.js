var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

test('invoice matches the billed GST and total for order 1002 with SAVE10', function () {
  var figures = invoice.computeInvoiceFigures({
    id: 1002,
    customer: 'Anil Kulkarni',
    coupon: 'SAVE10',
    items: [
      { name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
      { name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
    ]
  });

  assert.equal(figures.subtotal, 1020);
  assert.equal(figures.discount, 102);
  assert.equal(figures.tax, 45.9);
  assert.equal(figures.cgst, 22.95);
  assert.equal(figures.sgst, 22.95);
  assert.equal(figures.total, 963.9);
  assert.deepEqual(figures.rows.map(function (row) {
    return { gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), [{ gstPercent: 5, lineTax: 28.8 }, { gstPercent: 5, lineTax: 17.1 }]);
});

test('invoice applies the SAVE10 discount cap to order 1004', function () {
  var figures = invoice.computeInvoiceFigures({
    id: 1004,
    coupon: 'SAVE10',
    items: [{ name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }]
  });

  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 104.5);
  assert.equal(figures.total, 2194.5);
});

test('invoice uses the configured HSN slab for non-coupon 5% and 12% items', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [
      { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
      { name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
    ]
  });

  assert.deepEqual(figures.rows.map(function (row) {
    return { hsn: row.hsn, gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), [
    { hsn: '1006', gstPercent: 5, lineTax: 5 },
    { hsn: '0405', gstPercent: 12, lineTax: 12 }
  ]);
  assert.equal(figures.tax, 17);
});

test('invoice continues to match an 18% no-coupon order', function () {
  var figures = invoice.computeInvoiceFigures({
    id: 1008,
    items: [
      { name: 'Tea', hsn: '0902', price: 140, qty: 1 },
      { name: 'Kokum Sherbet Concentrate', hsn: '2106', price: 180, qty: 2 }
    ]
  });

  assert.equal(figures.tax, 90);
  assert.equal(figures.total, 590);
});
