var assert = require('node:assert/strict');
var test = require('node:test');
var pricing = require('../lib/pricing');

test('caps SAVE10 and apportions it before calculating GST by HSN slab', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 600, qty: 2 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 800, qty: 1 }
  ];

  assert.deepStrictEqual(pricing.computeTotals(items, 'SAVE10'), {
    subtotal: 2000,
    discount: 150,
    taxable: 1850,
    tax: 144.3,
    cgst: 72.15,
    sgst: 72.15,
    total: 1994.3,
    lines: [
      {
        id: 1, name: 'Rice', hsn: '1006', gstPercent: 5,
        gross: 1200, discount: 90, taxable: 1110, tax: 55.5, net: 1165.5
      },
      {
        id: 2, name: 'Ghee', hsn: '0405', gstPercent: 12,
        gross: 800, discount: 60, taxable: 740, tax: 88.8, net: 828.8
      }
    ]
  });
});

test('uses fallback GST for legacy items without HSN and preserves the rounded GST split', function () {
  var items = [{ id: 3, name: 'Legacy item', price: 5.05, qty: 1 }];
  var totals = pricing.computeTotals(items);

  assert.strictEqual(totals.lines[0].gstPercent, 18);
  assert.strictEqual(totals.discount, 0);
  assert.strictEqual(totals.tax, 0.91);
  assert.strictEqual(totals.cgst, 0.46);
  assert.strictEqual(totals.sgst, 0.45);
  assert.strictEqual(totals.total, 5.96);
});
