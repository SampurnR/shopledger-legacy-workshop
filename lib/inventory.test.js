const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('./inventory');
const orders = require('./orders');

// ============================================================================
// inventory.check
// Covers: workshop ticket 2 — sell up to available stock
// Cases:
//   [x] stock below sellable quantity is allowed
//   [x] exact sellable quantity is allowed, including reservations
//   [x] the last unreserved unit can be sold
//   [x] quantities beyond sellable stock are rejected
//   [x] duplicate lines cannot exceed sellable stock together
//   [x] unknown products are rejected
// ============================================================================
describe('inventory.check', () => {
  it('should allow a quantity below sellable stock', () => {
    const products = [{ id: 1, name: 'Ghee', stock: 4, reserved: 1 }];
    const result = inventory.check(products, [{ id: 1, qty: 2 }]);
    assert.deepEqual(result, { ok: true });
  });

  it('should allow exactly the sellable quantity', () => {
    const products = [{ id: 1, name: 'Chilli', stock: 4, reserved: 3 }];
    const result = inventory.check(products, [{ id: 1, qty: 1 }]);
    assert.deepEqual(result, { ok: true });
  });

  it('should allow selling the last unreserved unit', () => {
    const products = [{ id: 1, name: 'Ghee', stock: 1, reserved: 0 }];
    const result = inventory.check(products, [{ id: 1, qty: 1 }]);
    assert.deepEqual(result, { ok: true });
  });

  it('should reject a quantity above sellable stock', () => {
    const products = [{ id: 1, name: 'Chilli', stock: 4, reserved: 3 }];
    const result = inventory.check(products, [{ id: 1, qty: 2 }]);
    assert.equal(result.ok, false);
  });

  it('should reject duplicate lines whose total exceeds sellable stock', () => {
    const products = [{ id: 1, name: 'Ghee', stock: 4, reserved: 1 }];
    const result = inventory.check(products, [{ id: 1, qty: 2 }, { id: 1, qty: 2 }]);
    assert.equal(result.ok, false);
  });

  it('should reject an unknown product', () => {
    const result = inventory.check([], [{ id: 1, qty: 1 }]);
    assert.deepEqual(result, { ok: false, msg: 'Unknown product 1' });
  });
});

// ============================================================================
// orders.cancel
// Covers: workshop ticket 2 — return sold units once on cancellation
// Cases:
//   [x] cancelled items restore physical stock without changing reservations
//   [x] repeated cancellation does not restore stock twice
//   [x] missing orders do not change stock
// ============================================================================
describe('orders.cancel', () => {
  it('should restore physical stock and preserve reservations when cancelling', () => {
    const db = { products: [{ id: 1, stock: 1, reserved: 3 }], orders: [{ id: 1007, status: 'pending', items: [{ id: 1, qty: 2 }] }] };
    const result = orders.cancel(db, 1007);
    assert.equal(result.ok, true);
    assert.equal(db.products[0].stock, 3);
    assert.equal(db.products[0].reserved, 3);
    assert.equal(db.orders[0].status, 'cancelled');
  });

  it('should not restore stock twice when an order is already cancelled', () => {
    const db = { products: [{ id: 1, stock: 1, reserved: 0 }], orders: [{ id: 1007, status: 'pending', items: [{ id: 1, qty: 2 }] }] };
    orders.cancel(db, 1007);
    const result = orders.cancel(db, 1007);
    assert.equal(result.ok, false);
    assert.equal(db.products[0].stock, 3);
  });

  it('should leave stock unchanged for a missing order', () => {
    const db = { products: [{ id: 1, stock: 1, reserved: 0 }], orders: [] };
    const result = orders.cancel(db, 1007);
    assert.equal(result.ok, false);
    assert.equal(db.products[0].stock, 1);
  });
});
