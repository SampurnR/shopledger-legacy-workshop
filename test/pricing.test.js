const assert = require('node:assert/strict');
const { test } = require('node:test');
const coupons = require('../lib/coupons');
const pricing = require('../lib/pricing');
const tax = require('../lib/tax');

test('coupon codes are normalized and only active coupons appear in the catalog', () => {
  assert.equal(coupons.normalizeCode('  save10  '), 'SAVE10');
  assert.deepEqual(coupons.validate('', 0), { valid: true, code: '', discount: 0 });
  assert.deepEqual(coupons.listActive().map(coupon => coupon.code), [
    'SAVE10', 'FLAT50', 'WELCOME', 'WHOLESALE15'
  ]);
  assert.equal(coupons.getCoupon('diwali20'), null);
});

test('coupon validation distinguishes unknown, expired, and below-minimum codes', () => {
  assert.deepEqual(coupons.validate('unknown', 5000), {
    valid: false, error: 'Invalid coupon code: UNKNOWN'
  });
  assert.deepEqual(coupons.validate('diwali20', 5000), {
    valid: false, error: 'Coupon DIWALI20 has expired'
  });
  assert.deepEqual(coupons.validate('save10', 499.99), {
    valid: false, error: 'Coupon SAVE10 requires a minimum order subtotal of ₹500'
  });
  const atMinimum = coupons.validate('  save10 ', 500);
  assert.equal(atMinimum.valid, true);
  assert.equal(atMinimum.code, 'SAVE10');
  assert.equal(atMinimum.discount, 50);
});

test('checkout applies a percentage cap, flat discount, and two-decimal discount rounding', () => {
  assert.equal(coupons.calculateDiscount(2000, 'SAVE10'), 150);
  assert.equal(coupons.calculateDiscount(300, 'FLAT50'), 50);
  assert.equal(coupons.calculateDiscount(299.99, 'FLAT50'), 0);
  assert.equal(coupons.calculateDiscount(100.10, 'WELCOME'), 5.01);
});

test('GST supports percentage and decimal overrides and splits an odd paisa into CGST', () => {
  assert.equal(tax.getRateForItem({ hsn: '1006' }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: '1006', gstRate: 12 }), 0.12);
  assert.equal(tax.getRateForItem({ hsn: '1006', gstRate: 0.12 }), 0.12);
  assert.equal(tax.getRateForItem({ hsn: '1006', gstRate: 0 }), 0);
  assert.equal(tax.getRateForItem(), 0.18);
  assert.equal(tax.getSlabPercent({ hsn: '0405' }), 12);
  assert.deepEqual(tax.splitCgstSgst(1.01), { cgst: 0.51, sgst: 0.50 });
});

test('CURRENT BEHAVIOUR: a longer HSN with a configured prefix falls back to 18%', () => {
  assert.equal(tax.getSlabPercent({ hsn: '1006' }), 5);
  assert.equal(tax.getSlabPercent({ hsn: '100630' }), 18);
});

test('checkout apportions discounts before applying GST to each line', () => {
  const totals = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: '100', qty: '4' },
    { id: 2, name: 'Butter', hsn: '0405', price: 200, qty: 1 }
  ], 'SAVE10');

  assert.deepEqual(totals, {
    subtotal: 600,
    discount: 60,
    taxable: 540,
    tax: 39.6,
    cgst: 19.8,
    sgst: 19.8,
    total: 579.6,
    lines: [
      {
        id: 1, name: 'Rice', hsn: '1006', gstPercent: 5,
        gross: 400, discount: 40, taxable: 360, tax: 18, net: 378
      },
      {
        id: 2, name: 'Butter', hsn: '0405', gstPercent: 12,
        gross: 200, discount: 20, taxable: 180, tax: 21.6, net: 201.6
      }
    ]
  });
});

test('an empty checkout returns zero totals and no lines', () => {
  assert.deepEqual(pricing.computeTotals([], 'SAVE10'), {
    subtotal: 0, discount: 0, taxable: 0, tax: 0, cgst: 0, sgst: 0, total: 0, lines: []
  });
});

test('CURRENT BEHAVIOUR: rounded line discounts can sum to more than the cart discount', () => {
  const totals = pricing.computeTotals([
    { id: 1, hsn: '0902', price: 100, qty: 1 },
    { id: 2, hsn: '0902', price: 100, qty: 1 },
    { id: 3, hsn: '0902', price: 100, qty: 1 }
  ], 'FLAT50');

  assert.equal(totals.discount, 50);
  assert.equal(totals.taxable, 250);
  assert.equal(totals.total, 295);
  assert.deepEqual(totals.lines.map(line => line.discount), [16.67, 16.67, 16.67]);
  assert.deepEqual(totals.lines.map(line => line.net), [98.33, 98.33, 98.33]);
});
