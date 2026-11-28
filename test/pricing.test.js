var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');

test('CURRENT BEHAVIOUR: checkout resolves GST from HSN and taxes the discounted subtotal', function () {
  var totals = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 4, name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
  ], 'SAVE10');

  assert.deepEqual(totals, {
    subtotal: 1020,
    discount: 102,
    taxable: 918,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 640, discount: 64, taxable: 576, tax: 28.8, net: 604.8 },
      { id: 4, name: 'Sunflower oil', hsn: '1512', gstPercent: 5, gross: 380, discount: 38, taxable: 342, tax: 17.1, net: 359.1 }
    ]
  });
});

test('CURRENT BEHAVIOUR: checkout caps SAVE10 at 150 rupees', function () {
  var totals = pricing.computeTotals([
    { id: 5, name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 }
  ], 'SAVE10');

  assert.equal(totals.subtotal, 2240);
  assert.equal(totals.discount, 150);
  assert.equal(totals.tax, 104.5);
  assert.equal(totals.total, 2194.5);
});
