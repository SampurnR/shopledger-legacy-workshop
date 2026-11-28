var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');

test('Reliability & Edge Cases - Issue #409 Suite', function (t) {
  t.test('Preserves explicit product gstRate over HSN slab default (Issue #409)', function () {
    // HSN 1006 defaults to 5% slab in config, but product has explicit 12%
    var itemWithExplicitGst = {
      id: 1,
      name: 'Indrayani Basmati Rice 5kg (Special Batch)',
      hsn: '1006',
      price: 640,
      qty: 1,
      gstRate: 12
    };

    var rate = tax.getRateForItem(itemWithExplicitGst);
    assert.equal(rate, 0.12, 'Should use explicit 12% rather than HSN 5%');

    var totals = pricing.computeTotals([itemWithExplicitGst]);
    assert.equal(totals.lines[0].gstPercent, 12);
    assert.equal(totals.tax, 76.8); // 640 * 0.12 = 76.8
  });

  t.test('Coupon rounding: line discounts add up exactly to order discount (Issue #409)', function () {
    // Two lines of 50.05 each, subtotal = 100.10.
    // Coupon WELCOME = 10% discount -> discount = 10.01 (or 5.01 on 50.05).
    // Specifically test: two 50.05 lines with WELCOME
    var items = [
      { id: 10, name: 'Item A', price: 50.05, qty: 1, hsn: '1006' },
      { id: 11, name: 'Item B', price: 50.05, qty: 1, hsn: '1006' }
    ];

    var totals = pricing.computeTotals(items, 'WELCOME');
    var sumOfLineDiscounts = totals.lines.reduce(function (sum, l) {
      return Math.round((sum + l.discount) * 100) / 100;
    }, 0);

    assert.equal(sumOfLineDiscounts, totals.discount, 'Sum of line discounts must exactly equal order discount');
  });

  t.test('Pricing computeTotals accurately computes splits and taxable totals', function () {
    var items = [
      { id: 1, name: 'Basmati Rice', price: 100, qty: 2, hsn: '1006' } // 5% GST
    ];
    var totals = pricing.computeTotals(items);
    assert.equal(totals.subtotal, 200);
    assert.equal(totals.tax, 10);
    assert.equal(totals.cgst, 5);
    assert.equal(totals.sgst, 5);
    assert.equal(totals.total, 210);
  });
});
