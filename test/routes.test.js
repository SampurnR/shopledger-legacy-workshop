const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const app = require('../server');
const store = require('../lib/store');

function fixture() {
  return {
    nextOrderId: 1001, nextSettlementId: 501,
    products: [{ id: 1, name: 'Ghee', sku: 'G-1', hsn: '0405', price: 200, gstRate: 5, stock: 10 }],
    customers: [{ id: 1, name: 'Test account', openingBalance: 0, totalBilled: 0, totalSettled: 25, creditLimit: 5000 }],
    orders: [], settlements: [], auditLog: []
  };
}

test('order and settlement routes with an in-memory store', async t => {
  let db = fixture();
  t.mock.method(store, 'read', () => structuredClone(db));
  t.mock.method(store, 'write', updated => { db = updated; });
  const listener = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve())));
  await once(listener, 'listening');
  const root = 'http://127.0.0.1:' + listener.address().port;

  async function post(endpoint, payload) {
    const response = await fetch(root + endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });
    return { status: response.status, body: await response.json() };
  }

  await t.test('preview and checkout use the product rate and retain it for reprints', async () => {
    const cart = { items: [{ id: 1, qty: '4' }], coupon: 'SAVE10' };
    const preview = await post('/api/pricing/preview', cart);
    const checkout = await post('/api/orders', { ...cart, paymentMode: 'khata', customerId: 1, status: 'pending' });
    assert.equal(preview.status, 200);
    assert.equal(checkout.status, 201);
    assert.equal(checkout.body.status, 'pending');
    assert.equal(preview.body.totals.total, 756);
    assert.equal(checkout.body.total, 756);
    assert.equal(checkout.body.items[0].gstRate, 0.05);
    assert.equal(db.products[0].stock, 6);
    assert.equal(db.customers[0].totalBilled, 756);
    assert.equal(db.auditLog[0].action, 'ORDER_CREATED');

    db.products[0].gstRate = 18;
    const reprint = await fetch(root + '/orders/1001/invoice', { signal: AbortSignal.timeout(8000) });
    assert.equal(reprint.status, 200);
    const html = await reprint.text();
    assert.match(html, /Invoice Total<\/td><td class="r">₹756.00/);
    assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  });

  await t.test('rejects inconsistent quantities and unsupported order states before writing', async () => {
    db = fixture();
    const baseline = structuredClone(db);
    for (const qty of [0, 1.5, '2 boxes', true]) {
      const order = { items: [{ id: 1, qty }] };
      assert.equal((await post('/api/pricing/preview', order)).status, 400);
      assert.equal((await post('/api/orders', order)).status, 400);
    }
    const items = [{ id: 1, qty: 1 }];
    assert.equal((await post('/api/orders', { items, status: 'cancelled' })).status, 400);
    assert.equal((await post('/api/orders', { items, paymentMode: 'unknown' })).status, 400);
    assert.deepEqual(db, baseline);
  });

  await t.test('valid settlement POST persists the same amount returned in the JSON response', async () => {
    db = fixture();
    const response = await post('/api/customers/1/settle', { amount: '50.25', mode: 'cash' });
    assert.equal(response.status, 201);
    assert.equal(db.settlements[0].amount, 50.25);
    assert.equal(response.body.customer.totalSettled, 75.25);
    assert.deepEqual(db.settlements[0], response.body.settlement);
  });
});
