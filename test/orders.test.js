var test = require('node:test');
var assert = require('node:assert/strict');
var orders = require('../lib/orders');
var inventory = require('../lib/inventory');
var ledger = require('../lib/ledger');
var dates = require('../lib/dates');
var fixtures = require('./helpers/fixtures');
var guard = require('./helpers/database-integrity').guard;

function setup(t) {
  guard(t);
  t.mock.method(dates, 'today', function () { return '15/11/2026'; });
  return fixtures.database();
}

['cash', 'khata'].forEach(function (paymentMode) {
  test(paymentMode + ' order cancellation restores stock exactly once', function (t) {
    var db = setup(t);
    var items = [{ id: 1, name: 'Rice', price: 100, qty: 2 }];
    assert.deepEqual(inventory.check(db.products, items), { ok: true });
    if (paymentMode === 'khata') {
      assert.equal(ledger.chargeOrderToKhata(db, 1, 200).ok, true);
    }
    // Follow the route's in-memory creation sequence; orders.add alone does not deduct stock.
    inventory.reserve(db.products, items);
    var order = orders.add(db, {
      items: items, paymentMode: paymentMode, customerId: 1,
      subtotal: 200, discount: 0, tax: 0, total: 200
    });
    assert.equal(order.id, 1);
    assert.equal(order.date, '15/11/2026');
    assert.equal(order.status, 'completed');
    assert.equal(db.nextOrderId, 2);
    assert.equal(order.items[0].id, 1);
    assert.equal(Object.hasOwn(order.items[0], 'productId'), false);
    assert.equal(db.products[0].stock, 3);

    var result = orders.cancel(db, String(order.id), 'Customer changed mind');
    assert.equal(result.ok, true);
    assert.equal(result.order, order);
    assert.equal(order.status, 'cancelled');
    assert.equal(order.cancelledAt, '15/11/2026');
    assert.equal(order.cancelReason, 'Customer changed mind');
    assert.deepEqual(db.products[0], fixtures.product());
    assert.equal(inventory.getSellableStock(db.products[0]), 3);
    assert.equal(db.customers[0].totalBilled, 0);
    if (paymentMode === 'khata') assert.equal(db.customers[0].balance, 0);

    var afterCancellation = structuredClone(db);
    assert.deepEqual(orders.cancel(db, order.id, 'Again'), {
      ok: false, error: 'Order #1 is already cancelled'
    });
    assert.deepEqual(db, afterCancellation, 'repeat cancellation has no further effects');
  });
});

test('CURRENT BEHAVIOUR: missing order cancellation fails without mutation', function (t) {
  var db = setup(t);
  var before = structuredClone(db);
  assert.deepEqual(orders.cancel(db, 99), { ok: false, error: 'Order not found' });
  assert.deepEqual(db, before);
});

test('pending orders restore stock on cancellation with the default reason', function (t) {
  var db = setup(t);
  var items = [{ id: 1, qty: 1 }];
  inventory.reserve(db.products, items);
  var order = orders.add(db, { status: 'pending', items: items });
  assert.equal(orders.cancel(db, order.id).ok, true);
  assert.equal(order.status, 'cancelled');
  assert.equal(order.cancelReason, 'Cancelled by operator');
  assert.equal(order.cancelledAt, '15/11/2026');
  assert.deepEqual(db.products[0], fixtures.product());
});
