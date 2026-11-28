const assert = require('node:assert/strict');
const { test } = require('node:test');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

const lastUnitProducts = [
  { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', stock: 1, reserved: 0 },
  { id: 11, sku: 'SPC-001', name: 'Byadgi Kashmiri Chilli Powder 500g', stock: 4, reserved: 3 }
];

for (const fixture of lastUnitProducts) {
  test('accepts the last sellable unit of ' + fixture.sku + ' and preserves holds', () => {
    const product = { ...fixture };
    const items = [{ id: product.id, qty: 1 }];

    assert.equal(inventory.getSellableStock(product), 1);
    assert.deepEqual(inventory.check([product], items), { ok: true });
    inventory.reserve([product], items);

    assert.equal(product.stock, fixture.stock - 1);
    assert.equal(product.reserved, fixture.reserved);
    assert.equal(inventory.getSellableStock(product), 0);
    assert.equal(inventory.check([product], items).ok, false);
  });
}

test('allows the exact sellable quantity and rejects any more', () => {
  const product = { id: 4, name: 'Sunflower Oil', stock: 22, reserved: 4 };

  assert.deepEqual(inventory.check([product], [{ id: 4, qty: 18 }]), { ok: true });
  assert.deepEqual(inventory.check([product], [{ id: 4, qty: 19 }]), {
    ok: false, msg: 'Sunflower Oil is out of stock (18 sellable available)'
  });
  assert.equal(product.stock, 22);
});

test('checks the combined quantity of repeated lines for the same SKU', () => {
  const product = { id: 4, name: 'Sunflower Oil', stock: 7, reserved: 2 };

  assert.deepEqual(inventory.check([product], [{ id: 4, qty: 3 }, { id: '4', qty: '2' }]), { ok: true });
  assert.deepEqual(inventory.check([product], [{ id: 4, qty: 3 }, { id: '4', qty: '3' }]), {
    ok: false, msg: 'Sunflower Oil is out of stock (5 sellable available)'
  });
  assert.equal(product.stock, 7);
});

test('cancelling pending order 1007 restores both products and reverses its Khata debit once', () => {
  const ghee = { ...lastUnitProducts[0] };
  const oil = { id: 4, stock: 22, reserved: 4 };
  const customer = { id: 1, openingBalance: 50, totalBilled: 1500, totalSettled: 25 };
  const order = {
    id: 1007, status: 'pending', paymentMode: 'khata', customerId: 1, total: 1407,
    items: [{ id: 6, qty: 2 }, { id: 4, qty: 2 }]
  };
  const db = { products: [ghee, oil], customers: [customer], orders: [order] };

  const cancelled = orders.cancel(db, '1007', 'Returned');
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.order.status, 'cancelled');
  assert.equal(cancelled.order.cancelReason, 'Returned');
  assert.deepEqual([ghee.stock, oil.stock], [3, 24]);
  assert.deepEqual([ghee.reserved, oil.reserved], [0, 4]);
  assert.deepEqual([inventory.getSellableStock(ghee), inventory.getSellableStock(oil)], [3, 20]);
  assert.deepEqual([customer.totalBilled, customer.balance], [93, 118]);

  assert.equal(orders.cancel(db, '1007').ok, false);
  assert.deepEqual([ghee.stock, oil.stock, customer.balance], [3, 24, 118]);
});

test('cancelling a completed order reverses each of its stock deductions', () => {
  const product = { ...lastUnitProducts[1], stock: 8 };
  const items = [{ id: product.id, qty: 2 }, { id: product.id, qty: '1' }];
  const order = { id: 1008, status: 'completed', paymentMode: 'cash', items };
  const db = { products: [product], orders: [order] };

  inventory.reserve(db.products, items);
  assert.equal(product.stock, 5);
  assert.equal(orders.cancel(db, order.id).ok, true);
  assert.equal(product.stock, 8);
  assert.equal(product.reserved, 3);
});

test('releasing a wholesale quote only reduces the held quantity', () => {
  const product = { id: 11, stock: 4, reserved: 3 };

  inventory.release([product], [{ productId: 11, qty: 2 }]);

  assert.equal(product.stock, 4);
  assert.equal(product.reserved, 1);
  assert.equal(inventory.getSellableStock(product), 3);
});
