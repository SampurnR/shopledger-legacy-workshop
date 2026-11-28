const assert = require('node:assert/strict');
const { test } = require('node:test');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');
const invoice = require('../lib/invoice');

test('allows exact sellable stock and checks repeated lines together', () => {
  const products = [{ id: 1, stock: 12, reserved: 2 }];
  assert.equal(inventory.check(products, [{ id: 1, qty: 10 }]).ok, true);
  assert.equal(inventory.check(products, [{ id: 1, qty: 6 }, { id: 1, qty: 5 }]).ok, false);
});

test('cancellation restores physical stock and khata once, leaving other reservations intact', () => {
  const product = { id: 1, stock: 10, reserved: 2 };
  const customer = { id: 2, totalBilled: 100 };
  const order = { id: 3, paymentMode: 'khata', customerId: 2, total: 40, items: [{ id: 1, qty: 3 }] };
  const db = { products: [product], customers: [customer], orders: [order] };
  inventory.reserve(db.products, order.items);
  assert.equal(orders.cancel(db, 3).ok, true);
  assert.equal(orders.cancel(db, 3).ok, false);
  assert.deepEqual([product.stock, product.reserved, customer.totalBilled], [10, 2, 60]);
});

test('sorts and filters dates across month and year boundaries', () => {
  const db = { orders: [
    { id: 1, date: '31/12/2025' }, { id: 2, date: '31/01/2026' }, { id: 3, date: '01/02/2026' }
  ] };
  assert.deepEqual(orders.list(db).map(order => order.id), [3, 2, 1]);
  assert.deepEqual(orders.list(db, { from: '2026-01-01', to: '01/02/2026' }).map(order => order.id), [3, 2]);
});

test('new invoices use the saved line GST even when current tax rules differ', () => {
  const item = { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 };
  const order = { items: [item], subtotal: 100, discount: 0, tax: 12, total: 112,
    linePricing: [{ gross: 100, discount: 0, taxable: 100, gstPercent: 12, tax: 12, net: 112 }] };
  assert.equal(invoice.computeInvoiceFigures(order).rows[0].gstPercent, 12);
});

test('pending dispatch is excluded from billed totals and completion commits its hold and khata once', () => {
  const reports = require('../lib/reports');
  const product = { id: 1, stock: 10, reserved: 2 };
  const customer = { id: 2, totalBilled: 100 };
  const order = { id: 3, status: 'pending', heldForDispatch: true,
    paymentMode: 'khata', customerId: 2, total: 40, items: [{ id: 1, qty: 3 }] };
  const db = { products: [product], customers: [customer], orders: [order] };
  inventory.adjustHold(db.products, order.items, 1);
  assert.equal(reports.getDashboardSummary(db).grossRevenue, 0);
  assert.deepEqual([product.stock, product.reserved, customer.totalBilled], [10, 5, 100]);
  assert.equal(orders.complete(db, 3).ok, true);
  assert.equal(orders.complete(db, 3).ok, false);
  assert.deepEqual([product.stock, product.reserved, customer.totalBilled], [7, 2, 140]);
  assert.equal(reports.getDashboardSummary(db).grossRevenue, 40);
});

test('cancelling an unbilled dispatch removes its hold without crediting khata or increasing stock', () => {
  const product = { id: 1, stock: 10, reserved: 5 };
  const customer = { id: 2, totalBilled: 100 };
  const order = { id: 3, status: 'pending', heldForDispatch: true,
    paymentMode: 'khata', customerId: 2, total: 40, items: [{ id: 1, qty: 3 }] };
  const db = { products: [product], customers: [customer], orders: [order] };

  assert.equal(orders.cancel(db, 3).ok, true);
  assert.equal(orders.cancel(db, 3).ok, false);
  assert.equal(order.heldForDispatch, true);
  assert.deepEqual([product.stock, product.reserved, customer.totalBilled], [10, 2, 100]);
});

test('checkout rejects invalid inputs and retries return the same order without additional writes', t => {
  const store = require('../lib/store');
  const router = require('../routes/orders');
  const handler = router.stack.find(layer => layer.route.path === '/orders' && layer.route.methods.post)
    .route.stack[0].handle;
  let db = { products: [{ id: 1, name: 'Rice', hsn: '1006', stock: 2, price: 100 }],
    orders: [], nextOrderId: 1001 };
  let writes = 0;
  t.mock.method(store, 'read', () => structuredClone(db));
  t.mock.method(store, 'write', value => { db = value; writes++; });

  function post(body, key) {
    const req = { body, get: () => key };
    const res = {
      code: 200,
      status(code) { this.code = code; return this; },
      json(value) { this.value = value; return this; }
    };
    handler(req, res);
    return res;
  }

  const valid = { items: [{ id: 1, qty: 1 }, { id: 1, qty: 1 }] };
  for (const body of [{ items: [null] }, { items: [{ id: 1, qty: 1.5 }] },
    { ...valid, status: 'cancelled' }, { ...valid, paymentMode: {} }]) {
    assert.equal(post(body).code, 400);
  }
  assert.equal(post(valid).code, 400);
  assert.equal(writes, 0);
  const key = 'shopledger-test-request-1';
  const first = post(valid, key);
  assert.equal(first.code, 201);
  assert.equal(first.value.linePricing[0].tax, 10);
  assert.equal(post(valid, key).value.id, first.value.id);
  assert.equal(post({ ...valid, customer: 'Another customer' }, key).code, 409);
  assert.deepEqual([db.orders.length, db.products[0].stock, writes], [1, 0, 1]);
});
