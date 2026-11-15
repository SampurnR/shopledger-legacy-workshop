var assert = require('assert');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('ok - ' + name);
  } catch (err) {
    failed++;
    console.error('not ok - ' + name);
    console.error(err.stack || err);
  }
}

test('GST uses HSN slabs, explicit rates, and the default fallback', function () {
  assert.strictEqual(tax.getRateForItem({ hsn: '1006' }), 0.05);
  assert.strictEqual(tax.getRateForItem({ gstRate: 12 }), 0.12);
  assert.strictEqual(tax.getRateForItem({ hsn: '9999' }), 0.18);
});

test('coupon codes are normalized and inactive coupons are rejected', function () {
  var totals = pricing.computeTotals([{ price: 100, qty: 1, hsn: '1006' }], ' welcome ');
  assert.strictEqual(totals.discount, 5);
  assert.strictEqual(totals.tax, 4.75);
  assert.strictEqual(totals.total, 99.75);
  assert.strictEqual(require('../lib/coupons').validate('DIWALI20', 1000).valid, false);
});

test('cart discount is apportioned before per-line GST is calculated', function () {
  var totals = pricing.computeTotals([
    { id: 1, price: 100, qty: 1, hsn: '1006' },
    { id: 2, price: 100, qty: 1, hsn: '0902' }
  ], 'WELCOME');

  assert.strictEqual(totals.subtotal, 200);
  assert.strictEqual(totals.discount, 10);
  assert.strictEqual(totals.tax, 21.85);
  assert.strictEqual(totals.total, 211.85);
  assert.deepStrictEqual(totals.lines.map(function (line) { return line.tax; }), [4.75, 17.1]);
});

test('stock validation reserves one sellable unit as a buffer', function () {
  var products = [{ id: 1, name: 'Rice', stock: 10, reserved: 2 }];
  assert.strictEqual(inventory.check(products, [{ id: 1, qty: 7 }]).ok, true);
  assert.strictEqual(inventory.check(products, [{ id: 1, qty: 8 }]).ok, false);
  assert.strictEqual(inventory.getSellableStock(products[0]), 8);
});

test('cancellation marks the order cancelled but currently does not restore its stock', function () {
  var db = {
    nextOrderId: 1001,
    orders: [{ id: 1001, status: 'completed', paymentMode: 'cash', items: [{ id: 1, qty: 2 }], total: 20 }],
    products: [{ id: 1, stock: 8, reserved: 0 }]
  };

  var result = orders.cancel(db, 1001, 'test cancellation');
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.order.status, 'cancelled');
  assert.strictEqual(db.products[0].stock, 8);
  assert.strictEqual(orders.cancel(db, 1001).ok, false);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exitCode = 1;
