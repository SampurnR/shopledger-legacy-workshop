var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

function save10FivePercentOrder() {
  return {
    coupon: 'SAVE10',
    items: [
      { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { id: 4, sku: 'OIL-001', name: 'Oil', hsn: '1512', price: 190, qty: 2 }
    ]
  };
}

test('invoice uses the HSN GST rate for lines without an explicit gstRate', function () {
  var figures = invoice.computeInvoiceFigures(save10FivePercentOrder());

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[1].gstPercent, 5);
  assert.equal(figures.tax, 45.9);
});

test('invoice applies SAVE10 to the subtotal and respects its ₹150 cap', function () {
  var figures = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [{ id: 5, sku: 'OIL-002', name: 'Groundnut Oil', hsn: '1508', price: 1120, qty: 2 }]
  });

  assert.equal(figures.discount, 150);
  assert.equal(figures.total, 2194.5);
});
