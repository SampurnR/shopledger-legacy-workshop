const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');

const app = require('../server');
const store = require('../lib/store');
const pricing = require('../lib/pricing');
const config = require('../config');

async function runApp(t) {
  const db = {
    products: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, stock: 10 }],
    customers: [{ id: 1, name: 'Customer', creditLimit: 500, totalBilled: 0, totalSettled: 0 }],
    orders: [], settlements: [], nextOrderId: 1, nextSettlementId: 1
  };
  t.mock.method(store, 'read', () => db);
  t.mock.method(store, 'write', () => {});
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const root = 'http://127.0.0.1:' + server.address().port;
  async function post(path, body, key) {
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Idempotency-Key'] = key;
    const response = await fetch(root + path, { method: 'POST', headers, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  return { db, post };
}

test('checkout and preview reject invalid quantities and checkout rejects cancelled initial status', async (t) => {
  const { db, post } = await runApp(t);
  for (const qty of [0, -1, 1.5, '2kg', null]) {
    const cart = { items: [{ id: 1, qty }] };
    assert.equal((await post('/api/pricing/preview', cart)).status, 400);
    assert.equal((await post('/api/orders', cart)).status, 400);
  }
  const cancelled = await post('/api/orders', { items: [{ id: 1, qty: 1 }], status: 'cancelled' });
  assert.equal(cancelled.status, 400);
  assert.equal(db.products[0].stock, 10);
  assert.equal(db.orders.length, 0);
});

test('order and settlement retries return the original result and affect totals once', async (t) => {
  const { db, post } = await runApp(t);
  const cart = { items: [{ id: 1, qty: 1 }], customerId: 1, paymentMode: 'khata' };
  const first = await post('/api/orders', cart, 'order-test');
  assert.equal(first.status, 201);
  assert.deepEqual(await post('/api/orders', cart, 'order-test'), first);
  assert.equal((await post('/api/orders', { ...cart, customerId: 2 }, 'order-test')).status, 409);
  assert.equal(db.orders.length, 1);
  assert.equal(db.products[0].stock, 9);
  assert.equal(db.customers[0].totalBilled, 105);

  const paid = await post('/api/customers/1/settle', { amount: '5.01' }, 'settlement-test');
  assert.equal(paid.status, 201);
  assert.deepEqual(await post('/api/customers/1/settle', { amount: '5.01' }, 'settlement-test'), paid);
  assert.equal(db.settlements.length, 1);
  assert.equal(db.customers[0].balance, 99.99);
});

test('zero and default credit limits are enforced and settlements reject fractions of a paisa', async (t) => {
  const { db, post } = await runApp(t);
  db.customers[0].creditLimit = 0;
  const cart = { items: [{ id: 1, qty: 1 }], customerId: 1, paymentMode: 'khata' };
  assert.equal((await post('/api/orders', cart)).status, 409);
  delete db.customers[0].creditLimit;
  db.customers[0].totalBilled = 4950;
  assert.equal((await post('/api/orders', cart)).status, 409);
  assert.equal((await post('/api/customers/1/settle', { amount: '0.004' })).status, 400);
  assert.equal(db.settlements.length, 0);
  assert.equal(db.customers[0].totalSettled, 0);
});

test('dispatch completes a pending order without charging or deducting stock again', async (t) => {
  const { db, post } = await runApp(t);
  const cart = { items: [{ id: 1, qty: 1 }], customerId: 1, paymentMode: 'khata', status: 'pending' };
  const placed = await post('/api/orders', cart);
  assert.equal(placed.status, 201);
  const dispatched = await post('/api/orders/1/dispatch', {});
  assert.equal(dispatched.status, 200);
  assert.equal(dispatched.body.status, 'completed');
  assert.equal(db.products[0].stock, 9);
  assert.equal(db.customers[0].totalBilled, 105);
  assert.deepEqual(await post('/api/orders/1/dispatch', {}), dispatched);
});

test('preview and checkout use the catalog rate and new invoices keep the billed rate', async (t) => {
  const { db, post } = await runApp(t);
  db.products[0].gstRate = 12;
  const cart = { items: [{ id: 1, qty: '1' }] };
  assert.equal((await post('/api/pricing/preview', cart)).body.totals.tax, 12);
  const placed = await post('/api/orders', cart);
  assert.equal(placed.body.tax, 12);
  delete db.products[0].gstRate;
  assert.equal((await post('/api/orders', cart)).body.tax, 5);

  const invoice = require('../lib/invoice');
  const originalRate = config.tax.hsnSlabs['1006'];
  t.after(() => { config.tax.hsnSlabs['1006'] = originalRate; });
  config.tax.hsnSlabs['1006'] = 18;
  assert.equal(invoice.computeInvoiceFigures(db.orders[0]).tax, 12);
  assert.equal(invoice.computeInvoiceFigures(db.orders[1]).tax, 5);
});

test('rounded line discounts add up to the coupon amount', () => {
  const totals = pricing.computeTotals([{ price: 50.05, qty: 1 }, { price: 50.05, qty: 1 }], 'WELCOME');
  assert.equal(totals.discount, 5.01);
  assert.deepEqual(totals.lines.map((line) => line.discount), [2.51, 2.5]);
});

test('legacy invoices preserve the discount rounding used by the original order', () => {
  const items = [{ price: 50.05, qty: 1, hsn: '0405' }, { price: 50.05, qty: 1, hsn: '0405' }];
  const oldBill = { items, coupon: 'WELCOME', discount: 5.01, tax: 11.4, total: 106.49 };
  const printed = require('../lib/invoice').computeInvoiceFigures(oldBill);
  assert.equal(printed.tax, oldBill.tax);
  assert.equal(printed.total, oldBill.total);
});
