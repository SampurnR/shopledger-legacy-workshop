var test = require('node:test');
var assert = require('node:assert/strict');

var coupons = require('../lib/coupons');
var dates = require('../lib/dates');
var inventory = require('../lib/inventory');
var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');

test('coupon codes normalize; unknown and expired coupons are rejected', function () {
  assert.equal(coupons.normalizeCode('  save10 '), 'SAVE10');
  assert.equal(coupons.validate('save10', 500).valid, true);
  assert.deepEqual(coupons.validate('missing', 1000), {
    valid: false,
    error: 'Invalid coupon code: MISSING'
  });
  assert.equal(coupons.validate('DIWALI20', 1000).error, 'Coupon DIWALI20 has expired');
});

test('percent coupons enforce minimums and maximum discount caps', function () {
  assert.equal(coupons.calculateDiscount(499, 'SAVE10'), 0);
  assert.equal(coupons.calculateDiscount(500, 'SAVE10'), 50);
  assert.equal(coupons.calculateDiscount(5000, 'SAVE10'), 150);
});

test('pricing apportions coupon discount before applying each HSN GST slab', function () {
  var totals = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Coffee', hsn: '0901', price: 100, qty: 1 }
  ], 'WELCOME');

  assert.deepEqual(totals, {
    subtotal: 200,
    discount: 10,
    taxable: 190,
    tax: 21.85,
    cgst: 10.93,
    sgst: 10.92,
    total: 211.85,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 100, discount: 5, taxable: 95, tax: 4.75, net: 99.75 },
      { id: 2, name: 'Coffee', hsn: '0901', gstPercent: 18, gross: 100, discount: 5, taxable: 95, tax: 17.1, net: 112.1 }
    ]
  });
});

test('tax resolves explicit rates before HSN slabs and splits rounding remainder to SGST', function () {
  assert.equal(tax.getRateForItem({ gstRate: 12, hsn: '1006' }), 0.12);
  assert.equal(tax.getRateForItem({ hsn: '1006' }), 0.05);
  assert.deepEqual(tax.splitCgstSgst(1.01), { cgst: 0.51, sgst: 0.5 });
});

test('inventory excludes reserved units and treats requested quantity equal to sellable stock as unavailable', function () {
  var products = [{ id: 1, name: 'Rice', stock: 5, reserved: 2, price: 10 }];
  assert.equal(inventory.getSellableStock(products[0]), 3);
  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 2 }]), { ok: true });
  assert.equal(inventory.check(products, [{ id: 1, qty: 3 }]).ok, false);
  assert.deepEqual(inventory.check(products, [{ id: 9, qty: 1 }]), { ok: false, msg: 'Unknown product 9' });
});

test('date helpers normalize HTML date keys and assign April to the new fiscal year', function () {
  assert.equal(dates.normalizeDateKey('2022-04-01'), '01/04/2022');
  assert.equal(dates.getFiscalYear('01/04/2022'), 'FY22-23');
  assert.equal(dates.getFiscalYear('31/03/2022'), 'FY21-22');
  assert.equal(dates.getFiscalYear('invalid'), 'FY21-22');
});

test('invoice figures use the default tax rate and render escaped item names', function () {
  var order = {
    id: 42,
    date: '01/04/2022',
    total: 118,
    items: [{ name: '<Rice & Dal>', price: 100, qty: 1 }]
  };
  assert.equal(invoice.computeInvoiceFigures(order).total, 118);
  var html = invoice.render(order);
  assert.match(html, /&lt;Rice &amp; Dal&gt;/);
  assert.match(html, /INV-42/);
});

test('cancelling an order releases reserved stock, reverses khata debit, and cannot be repeated', function () {
  var db = {
    nextOrderId: 10,
    orders: [],
    products: [{ id: 1, stock: 4, reserved: 2 }],
    customers: [{ id: 3, name: 'Asha', openingBalance: 0, totalBilled: 80, totalSettled: 0 }]
  };
  var order = orders.add(db, {
    date: '01/04/2022', customerId: 3, paymentMode: 'khata', total: 80,
    items: [{ productId: 1, qty: 2 }]
  });

  assert.equal(orders.cancel(db, order.id, 'requested').ok, true);
  assert.equal(db.products[0].reserved, 0);
  assert.equal(db.customers[0].totalBilled, 0);
  assert.deepEqual(orders.cancel(db, order.id).error, 'Order #10 is already cancelled');
});
