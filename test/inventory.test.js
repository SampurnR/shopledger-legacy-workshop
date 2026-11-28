const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');
const inventory = require('../lib/inventory');
const store = require('../lib/store');
const orderRoutes = require('../routes/orders');

let server;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', orderRoutes);
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});

function fixture(t, orders = [], riceStock = 10) {
  const initial = {
    products: [
      { id: 1, name: 'Rice', price: 10, stock: riceStock, reserved: 3 },
      { id: 2, name: 'Tea', price: 20, stock: 5, reserved: 1 }
    ],
    orders,
    customers: [
      { id: 1, name: 'Regular customer', creditLimit: 1000,
        openingBalance: 10, totalBilled: 20, totalSettled: 5, balance: 25 }
    ],
    auditLog: [],
    nextOrderId: 1001
  };
  let persisted = JSON.stringify(initial);
  let loaded;
  t.mock.method(store, 'read', () => {
    loaded = JSON.parse(persisted);
    return loaded;
  });
  const write = t.mock.method(store, 'write', db => {
    persisted = JSON.stringify(db);
  });
  return {
    initial,
    snapshot: () => persisted,
    read: () => JSON.parse(persisted),
    loaded: () => loaded,
    writes: () => write.mock.callCount()
  };
}

async function post(path, body) {
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/api' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

test('sellable stock excludes reservations and clamps at zero', () => {
  assert.equal(inventory.getSellableStock({ stock: 10, reserved: 3 }), 7);
  assert.equal(inventory.getSellableStock({ stock: 2, reserved: 3 }), 0);
  assert.equal(inventory.getSellableStock({ stock: 2 }), 2);
});

test('checkout below sellable stock saves the resolved ID and preserves reservations', async t => {
  const db = fixture(t);
  const result = await post('/orders', { items: [{ id: '01', qty: '2' }] });
  assert.equal(result.status, 201);
  assert.equal(result.body.items[0].id, 1);
  assert.equal(result.body.items[0].qty, 2);
  assert.equal(db.read().products[0].stock, 8);
  assert.equal(db.read().products[0].reserved, 3);
  assert.equal(db.read().auditLog[0].action, 'ORDER_CREATED');
});

test('checkout normalizes invalid and negative quantities to one', async t => {
  const db = fixture(t);
  const items = [undefined, 'invalid', -2, 'Infinity', 0].map(qty => ({ id: 1, qty }));
  const result = await post('/orders', { items });
  assert.equal(result.status, 201);
  assert.deepEqual(result.body.items.map(item => item.qty), [1, 1, 1, 1, 1]);
  assert.equal(db.read().products[0].stock, 5);
  assert.equal(db.read().products[0].reserved, 3);
});

test('checkout saves a fractional request of 2.9 as two units', async t => {
  const db = fixture(t);
  const result = await post('/orders', { items: [{ id: 1, qty: 2.9 }] });
  assert.equal(result.status, 201);
  const saved = db.read();
  assert.equal(saved.orders[0].items[0].qty, 2);
  assert.equal(saved.products[0].stock, db.initial.products[0].stock - 2);
  assert.equal(saved.products[0].reserved, 3);
});

test('failed checkout leaves the persisted snapshot unchanged', async t => {
  const db = fixture(t);
  const snapshot = db.snapshot();
  for (const [body, status, error] of [
    [{ items: [{ id: 1, qty: 8 }] }, 409, /7 sellable available/],
    [{ items: [{ id: 1, qty: '9'.repeat(400) }] }, 409],
    [{ items: [{ id: 1, qty: 2 }], coupon: 'INVALID' }, 400],
    [{ items: [{ id: 1, qty: 2 }], paymentMode: 'khata', customerId: 999 }, 409],
    [{ items: [{ id: 999, qty: 2 }] }, 400, /Unknown product/]
  ]) {
    const result = await post('/orders', body);
    assert.equal(result.status, status);
    if (error) assert.match(result.body.error, error);
    assert.equal(db.writes(), 0);
    assert.equal(db.snapshot(), snapshot);
  }
});

test('checkout can buy every sellable unit without touching wholesale reservations', async t => {
  const db = fixture(t);
  const result = await post('/orders', { items: [{ id: 1, qty: 7 }] });
  assert.equal(result.status, 201);
  assert.equal(db.read().products[0].stock, 3);
  assert.equal(db.read().products[0].reserved, 3);
});

test('mixed forms of the same product ID share one sellable stock limit', async t => {
  const db = fixture(t);
  const snapshot = db.snapshot();
  const items = [{ id: 1, qty: 4 }, { id: '01', qty: 4 }];
  assert.deepEqual(inventory.check(db.initial.products, items), {
    ok: false, msg: 'Rice is out of stock (7 sellable available)'
  });
  const rejected = await post('/orders', { items });
  assert.equal(rejected.status, 409);
  assert.equal(db.writes(), 0);
  assert.equal(db.snapshot(), snapshot);

  items[1].qty = 3;
  const accepted = await post('/orders', { items });
  assert.equal(accepted.status, 201);
  assert.deepEqual(accepted.body.items.map(item => item.qty), [4, 3]);
  assert.equal(db.read().products[0].stock, 3);
  assert.equal(db.read().products[0].reserved, 3);
});

for (const status of ['pending', 'completed']) {
  async function cancelOrder(t) {
    const db = fixture(t);
    const created = await post('/orders', {
      status, paymentMode: 'khata', customerId: 1,
      items: [{ id: 1, qty: 2 }, { id: '1', qty: 1 }, { id: 2, qty: 2 }]
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, status);
    const purchased = db.read();
    assert.deepEqual(purchased.products.map(product => product.stock), [7, 3]);
    assert.ok(purchased.customers[0].totalBilled > db.initial.customers[0].totalBilled);
    const path = '/orders/' + created.body.id + '/cancel';
    const cancelled = await post(path, { reason: 'Customer request' });
    assert.equal(cancelled.status, 200);
    return { db, path, cancelled: cancelled.body };
  }

  test(status + ' cancellation preserves Khata reversal, audit and repeat protection', async t => {
    const { db, path, cancelled } = await cancelOrder(t);
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.cancelReason, 'Customer request');
    assert.ok(cancelled.cancelledAt);
    const saved = db.read();
    assert.deepEqual(saved.orders, [cancelled]);
    assert.deepEqual(saved.customers, db.initial.customers);
    assert.deepEqual(saved.auditLog.map(entry => entry.action), ['ORDER_CANCELLED', 'ORDER_CREATED']);
    const snapshot = db.snapshot();
    const repeated = await post(path, { reason: 'Duplicate request' });
    assert.equal(repeated.status, 400);
    assert.match(repeated.body.error, /already cancelled/);
    assert.equal(db.writes(), 2);
    assert.equal(db.snapshot(), snapshot);
  });

  test(status + ' cancellation restores physical stock for every saved line', async t => {
    const { db } = await cancelOrder(t);
    assert.deepEqual(db.read().products, db.initial.products);
  });
}

test('historical cancellation skips a missing product and restores the remaining line once', async t => {
  const db = fixture(t, [{
    id: 1007,
    status: 'pending',
    paymentMode: 'cash',
    items: [{ id: 999, qty: 1 }, { id: '01', qty: '2' }]
  }]);
  const path = '/orders/1007/cancel';
  const result = await post(path, { reason: 'Historical order' });
  assert.equal(result.status, 200);
  const saved = db.read();
  assert.equal(saved.orders[0].status, 'cancelled');
  assert.deepEqual(saved.products, [
    { ...db.initial.products[0], stock: 12 },
    db.initial.products[1]
  ]);
  const snapshot = db.snapshot();
  const repeated = await post(path, {});
  assert.equal(repeated.status, 400);
  assert.match(repeated.body.error, /already cancelled/);
  assert.equal(db.writes(), 1);
  assert.equal(db.snapshot(), snapshot);
});

for (const [label, items] of [
  ['a missing quantity', [{ id: 1 }]],
  ['a nonnumeric quantity', [{ id: 1, qty: 'invalid' }]],
  ['a negative quantity', [{ id: 1, qty: -2 }]],
  ['a non-finite quantity', [{ id: 1, qty: 'Infinity' }]],
  ['a zero quantity', [{ id: 1, qty: 0 }]],
  ['a fractional quantity', [{ id: 1, qty: 2.9 }]],
  ['a boolean quantity', [{ id: 1, qty: true }]],
  ['a null quantity', [{ id: 1, qty: null }]],
  ['a null saved line', [null]],
  ['valid and invalid lines', [{ id: 1, qty: 2 }, { id: 2, qty: -2 }]]
]) {
  test('cancellation rejects ' + label + ' without changing the snapshot', async t => {
    const db = fixture(t, [{
      id: 1007, status: 'pending', paymentMode: 'khata', customerId: 1, total: 10, items
    }]);
    const snapshot = db.snapshot();
    const result = await post('/orders/1007/cancel', { reason: 'Historical order' });
    const stocks = db.read().products.map(product => product.stock);
    assert.equal(result.status, 400, 'Persisted physical stocks: ' + JSON.stringify(stocks));
    assert.match(result.body.error, /invalid saved (quantity|order line)/i);
    assert.equal(db.writes(), 0);
    assert.equal(db.snapshot(), snapshot);
    assert.deepEqual(db.loaded(), JSON.parse(snapshot));
  });
}

for (const [label, stock, items] of [
  ['unsafe cumulative stock', Number.MAX_SAFE_INTEGER - 1, [{ id: 1, qty: 1 }, { id: '01', qty: 1 }]],
  ['non-finite resulting stock', 'Infinity', [{ id: 1, qty: 1 }]],
  ['negative resulting stock', -2, [{ id: 1, qty: 1 }]]
]) {
  test('cancellation rejects ' + label + ' without changing the snapshot', async t => {
    const db = fixture(t, [{
      id: 1007, status: 'completed', paymentMode: 'khata', customerId: 1, total: 10, items
    }], stock);
    const snapshot = db.snapshot();
    const result = await post('/orders/1007/cancel', {});
    assert.equal(result.status, 400);
    assert.match(result.body.error, /invalid.*stock/i);
    assert.equal(db.writes(), 0);
    assert.equal(db.snapshot(), snapshot);
    assert.deepEqual(db.loaded(), JSON.parse(snapshot));
  });
}
