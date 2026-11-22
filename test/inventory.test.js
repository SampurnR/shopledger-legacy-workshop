// Characterization tests for lib/inventory.js and order cancellation (Ticket 2).
// All data is in-memory. These tests never read or write data/db.json.
var test = require('node:test');
var assert = require('node:assert/strict');

var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

function products() {
  return [
    { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', price: 640, stock: 18, reserved: 2 },
    { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', price: 190, stock: 22, reserved: 4 },
    { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', price: 450, stock: 1, reserved: 0 },
    { id: 10, sku: 'GRN-004', name: 'Organic Kolhapuri Jaggery 1kg', price: 85, stock: 0, reserved: 0 },
    { id: 11, sku: 'SPC-001', name: 'Byadgi Kashmiri Chilli Powder 500g', price: 220, stock: 4, reserved: 3 }
  ];
}

function dbWithPendingOrder() {
  var p = products();
  p[2].stock = 3; // ghee after #1007 took 2
  return {
    products: p,
    customers: [{ id: 4, name: 'Suresh Deshmukh', openingBalance: 1200, totalBilled: 1407, totalSettled: 1000, creditLimit: 15000 }],
    orders: [{
      id: 1007, date: '04/03/2022', customer: 'Suresh Deshmukh', customerId: 4, paymentMode: 'khata', status: 'pending',
      items: [
        { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', hsn: '0405', price: 450, qty: 2 },
        { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
      ],
      coupon: '', subtotal: 1280, discount: 0, tax: 127, total: 1407
    }]
  };
}

// ---------- Behaviour that is correct today ----------

test('getSellableStock = physical stock minus reserved', function () {
  var p = products();
  assert.equal(inventory.getSellableStock(p[0]), 16);
  assert.equal(inventory.getSellableStock(p[4]), 1);
  assert.equal(inventory.getSellableStock(null), 0);
  assert.equal(inventory.getSellableStock({ stock: 1, reserved: 5 }), 0);
});

test('check() allows a quantity below sellable stock', function () {
  assert.deepEqual(inventory.check(products(), [{ id: 1, qty: 5 }]), { ok: true });
});

test('check() rejects more than sellable stock', function () {
  var r = inventory.check(products(), [{ id: 1, qty: 17 }]);
  assert.equal(r.ok, false);
  assert.match(r.msg, /out of stock \(16 sellable available\)/);
});

test('check() rejects an out-of-stock product and an unknown product', function () {
  assert.equal(inventory.check(products(), [{ id: 10, qty: 1 }]).ok, false);
  assert.deepEqual(inventory.check(products(), [{ id: 99, qty: 1 }]), { ok: false, msg: 'Unknown product 99' });
});

test('reserve() deducts sold quantity from physical stock', function () {
  var p = products();
  inventory.reserve(p, [{ id: 1, qty: 3 }]);
  assert.equal(p[0].stock, 15);
  assert.equal(p[0].reserved, 2);
});

test('cancel() marks the order cancelled and reverses the khata debit', function () {
  var db = dbWithPendingOrder();
  var r = orders.cancel(db, 1007, 'test');
  assert.equal(r.ok, true);
  assert.equal(db.orders[0].status, 'cancelled');
  assert.equal(db.customers[0].totalBilled, 0);
  assert.equal(orders.cancel(db, 1007).ok, false);
});

// ---------- Formerly CURRENT BEHAVIOUR: updated after the Ticket 2 fix ----------

test('UPDATED (was CURRENT BEHAVIOUR): can sell the last sellable ghee jar (DRY-001, 1 sellable)', function () {
  assert.deepEqual(inventory.check(products(), [{ id: 6, qty: 1 }]), { ok: true });
});

test('UPDATED (was CURRENT BEHAVIOUR): can sell the last sellable chilli packet (SPC-001, physical 4, reserved 3)', function () {
  assert.deepEqual(inventory.check(products(), [{ id: 11, qty: 1 }]), { ok: true });
});

test('UPDATED (was CURRENT BEHAVIOUR): buying exactly the sellable stock of a SKU succeeds', function () {
  assert.deepEqual(inventory.check(products(), [{ id: 1, qty: 16 }]), { ok: true });
});

test('UPDATED (was CURRENT BEHAVIOUR): cancelling pending #1007 returns items to stock', function () {
  var db = dbWithPendingOrder();
  orders.cancel(db, 1007, 'test');
  assert.equal(db.products[2].stock, 5);
  assert.equal(db.products[1].stock, 24);
});

test('UPDATED (was CURRENT BEHAVIOUR): release() matches order lines by id and restores physical stock', function () {
  var p = products();
  inventory.release(p, [{ id: 4, qty: 2 }]);
  assert.equal(p[1].stock, 24);
  assert.equal(p[1].reserved, 4);
});

// ---------- CORRECT BEHAVIOUR (Ticket 2) ----------

test('can sell the last sellable unit (DRY-001 and SPC-001)', function () {
  assert.deepEqual(inventory.check(products(), [{ id: 6, qty: 1 }]), { ok: true });
  assert.deepEqual(inventory.check(products(), [{ id: 11, qty: 1 }]), { ok: true });
});

test('can buy exactly the sellable stock of a SKU, but not one more', function () {
  assert.deepEqual(inventory.check(products(), [{ id: 1, qty: 16 }]), { ok: true });
  assert.equal(inventory.check(products(), [{ id: 11, qty: 2 }]).ok, false);
});

test('cancelling pending #1007 returns its items to stock', function () {
  var db = dbWithPendingOrder();
  orders.cancel(db, 1007, 'test');
  assert.equal(db.products[2].stock, 5);  // ghee 3 + 2
  assert.equal(db.products[1].stock, 24); // oil 22 + 2
  assert.equal(db.products[1].reserved, 4); // wholesale holds untouched
});

test('sell then cancel puts stock back where it started', function () {
  var p = products();
  var items = [{ id: 6, qty: 1 }, { id: 1, qty: 3 }];
  inventory.reserve(p, items);
  inventory.release(p, items);
  assert.deepEqual(p, products());
});
