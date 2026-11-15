var assert = require('assert');
var test = require('node:test');

var coupons = require('../lib/coupons');
var dates = require('../lib/dates');
var inventory = require('../lib/inventory');
var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');

test('pricing applies coupon before item GST and splits GST', function () {
  var result = pricing.computeTotals([
    { id: 1, name: 'Rice', price: 300, qty: 2, hsn: '1006' }
  ], 'SAVE10');

  assert.deepStrictEqual({
    subtotal: result.subtotal,
    discount: result.discount,
    taxable: result.taxable,
    tax: result.tax,
    cgst: result.cgst,
    sgst: result.sgst,
    total: result.total
  }, {
    subtotal: 600,
    discount: 60,
    taxable: 540,
    tax: 27,
    cgst: 13.5,
    sgst: 13.5,
    total: 567
  });
  assert.strictEqual(result.lines[0].gstPercent, 5);
});

test('coupon validation enforces minimums, caps, and expiry', function () {
  assert.strictEqual(coupons.calculateDiscount(5000, 'save10'), 150);
  assert.strictEqual(coupons.validate('WHOLESALE15', 1000).valid, false);
  assert.strictEqual(coupons.validate('DIWALI20', 2000).error, 'Coupon DIWALI20 has expired');
  assert.strictEqual(coupons.validate('unknown', 500).valid, false);
});

test('tax resolves explicit rates, HSN slabs, and the fallback rate', function () {
  assert.strictEqual(tax.getSlabPercent({ gstRate: 12 }), 12);
  assert.strictEqual(tax.getSlabPercent({ hsn: '0405' }), 12);
  assert.strictEqual(tax.getSlabPercent({ hsn: '9999' }), 18);
});

test('inventory permits quantity equal to sellable stock', function () {
  var products = [{ id: 1, name: 'Rice', stock: 10, reserved: 2 }];
  assert.deepStrictEqual(inventory.check(products, [{ id: 1, qty: 7 }]), { ok: true });
  assert.deepStrictEqual(inventory.check(products, [{ id: 1, qty: 8 }]), { ok: true });
  assert.strictEqual(inventory.check(products, [{ id: 1, qty: 9 }]).ok, false);
});

test('cancelling an order restores its deducted stock', function () {
  var db = {
    nextOrderId: 1001,
    products: [{ id: 1, name: 'Rice', stock: 1, reserved: 0 }],
    orders: [],
    customers: []
  };
  var items = [{ id: 1, name: 'Rice', price: 100, qty: 1 }];

  inventory.reserve(db.products, items);
  var order = orders.add(db, { items: items, total: 118 });

  var result = orders.cancel(db, order.id, 'Customer changed mind');

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.order.status, 'cancelled');
  assert.strictEqual(db.products[0].stock, 1);
  assert.strictEqual(db.products[0].reserved, 0);
});

test('dates normalize HTML date input and use an April fiscal-year boundary', function () {
  assert.strictEqual(dates.normalizeDateKey('2021-04-05'), '05/04/2021');
  assert.strictEqual(dates.getFiscalYear('31/03/2021'), 'FY20-21');
  assert.strictEqual(dates.getFiscalYear('01/04/2021'), 'FY21-22');
});

test('invoice calculation preserves the accountant/order-ledger discrepancy', function () {
  var result = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [{ name: 'Rice', price: 100, qty: 1 }]
  });

  // The invoice applies a percentage coupon to subtotal plus tax, unlike pricing.js.
  assert.strictEqual(result.subtotal, 100);
  assert.strictEqual(result.tax, 18);
  assert.strictEqual(result.discount, 11.8);
  assert.strictEqual(result.total, 106.2);
});
