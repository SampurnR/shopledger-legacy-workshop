const test = require('node:test');
const assert = require('node:assert/strict');

const coupons = require('../lib/coupons');
const dates = require('../lib/dates');
const inventory = require('../lib/inventory');
const ledger = require('../lib/ledger');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const tax = require('../lib/tax');

test('subtotal and GST use the HSN slab after coupon discount', function () {
  const result = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 }
  ], 'WELCOME');

  assert.equal(result.subtotal, 640);
  assert.equal(result.discount, 32);
  assert.equal(result.taxable, 608);
  assert.equal(result.tax, 30.4);
  assert.equal(result.cgst, 15.2);
  assert.equal(result.sgst, 15.2);
  assert.equal(result.total, 638.4);
});

test('coupon codes are case-insensitive and SAVE10 is capped', function () {
  assert.equal(coupons.normalizeCode(' save10 '), 'SAVE10');
  assert.equal(coupons.calculateDiscount(5000, 'save10'), 150);
  assert.equal(coupons.validate('SAVE10', 499).valid, false);
  assert.equal(coupons.validate('DIWALI20', 2000).valid, false);
  assert.equal(coupons.validate('NOTREAL', 2000).valid, false);
});

test('tax falls back to configured GST for an unmapped HSN', function () {
  assert.equal(tax.getRateForItem({ hsn: '9999' }), 0.18);
});

test('date helpers normalize HTML dates and calculate Indian fiscal years', function () {
  assert.equal(dates.normalizeDateKey('2026-02-01'), '01/02/2026');
  assert.equal(dates.getFiscalYear('31/03/2026'), 'FY25-26');
  assert.equal(dates.getFiscalYear('01/04/2026'), 'FY26-27');
});

test('characterization: order date filtering compares normalized date strings', function () {
  const result = orders.list({
    orders: [
      { id: 1, date: '31/01/2026', status: 'completed' },
      { id: 2, date: '02/02/2026', status: 'completed' }
    ]
  }, { from: '2026-02-01' });

  // Current DD/MM/YYYY lexical comparison includes January 31 for a February start.
  assert.deepEqual(result.map(function (order) { return order.id; }), [1, 2]);
});

test('characterization: stock check rejects a quantity equal to sellable stock', function () {
  const result = inventory.check([{ id: 1, name: 'Rice', stock: 5, reserved: 0 }], [
    { id: 1, qty: 5 }
  ]);

  assert.equal(result.ok, false);
});

test('characterization: cancellation release looks for productId on order lines', function () {
  const products = [{ id: 1, stock: 5, reserved: 2 }];
  inventory.release(products, [{ id: 1, qty: 1 }]);

  // Orders store id, while release currently looks up productId.
  assert.equal(products[0].reserved, 2);
});

test('characterization: settlement adds a string amount without numeric conversion', function () {
  const db = {
    nextSettlementId: 1,
    settlements: [],
    customers: [{ id: 1, name: 'Test Customer', openingBalance: 100, totalBilled: 0, totalSettled: 0 }]
  };

  const result = ledger.recordSettlement(db, 1, '25.00', 'upi', '');

  assert.equal(result.ok, true);
  assert.equal(typeof result.customer.totalSettled, 'string');
  assert.equal(result.customer.totalSettled, '025.00');
  assert.equal(result.customer.balance, 75);
});
