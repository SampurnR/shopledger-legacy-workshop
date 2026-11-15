const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const app = require('../server');
const store = require('../lib/store');

async function openShop(t) {
  let db = {
    products: [{ id: 1, sku: 'R-1', name: 'Rice', hsn: '1006', price: 500, stock: 4, reserved: 2 }],
    customers: [{ id: 1, name: 'Customer', creditLimit: 600, openingBalance: 100,
      totalBilled: 0, totalSettled: 20, balance: 80 }],
    orders: [], settlements: [], auditLog: [], nextOrderId: 1001, nextSettlementId: 501
  };
  // Like the JSON store, each read yields a separate copy and only a write persists changes.
  t.mock.method(store, 'read', () => structuredClone(db));
  t.mock.method(store, 'write', updated => { db = structuredClone(updated); });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));

  return async function request(path, expectedStatus, body) {
    const options = body === undefined ? {} : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    };
    const response = await fetch('http://127.0.0.1:' + server.address().port + path, options);
    assert.equal(response.status, expectedStatus, path);
    return response.headers.get('content-type').includes('application/json')
      ? response.json() : response.text();
  };
}

test('pending khata sale agrees with preview and invoice, and retains its stock deduction after cancellation', async t => {
  const request = await openShop(t);
  const sale = { items: [{ id: 1, qty: 1 }], coupon: ' save10 ', status: 'pending',
    paymentMode: 'khata', customerId: 1 };
  const preview = await request('/api/pricing/preview', 200, sale);
  const order = await request('/api/orders', 201, sale);
  const saved = await request('/api/orders/' + order.id, 200);
  assert.equal(saved.status, 'pending');
  assert.equal(saved.coupon, 'SAVE10');
  for (const [field, expected] of Object.entries({ subtotal: 500, discount: 50, tax: 22.5, total: 472.5 })) {
    assert.equal(preview.totals[field], expected, field);
    assert.equal(saved[field], expected, field);
  }
  const printed = await request('/orders/' + order.id + '/invoice', 200);
  const invoiceText = printed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(invoiceText, /CGST \+ SGST \(Total GST\) ₹22\.50/);
  assert.match(invoiceText, /Invoice Total ₹472\.50/);
  assert.doesNotMatch(invoiceText, /Accountant Reconciliation Notice/);

  const account = async () => (await request('/api/customers', 200)).customers[0];
  const product = async () => (await request('/api/products', 200))[0];
  assert.equal((await account()).balance, 552.5);
  assert.equal((await product()).stock, 3);
  const dashboard = await request('/api/reports/dashboard', 200);
  assert.equal(dashboard.summary.grossRevenue, 472.5);
  assert.equal(dashboard.summary.pendingCount, 1);

  const cancelPath = '/api/orders/' + order.id + '/cancel';
  const cancelled = await request(cancelPath, 200, { reason: 'Returned' });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancelReason, 'Returned');
  await request(cancelPath, 400, {});
  assert.equal((await account()).balance, 80);
  const after = await product();
  assert.deepEqual([after.stock, after.reserved, after.sellable], [3, 2, 1]);
  const finalDashboard = await request('/api/reports/dashboard', 200);
  assert.equal(finalDashboard.summary.grossRevenue, 0);
  assert.equal(finalDashboard.summary.cancelledCount, 1);
  assert.deepEqual(finalDashboard.recentAudit.map(entry => entry.action), ['ORDER_CANCELLED', 'ORDER_CREATED']);
  assert.equal((await request('/api/reports/gst-reconciliation', 200)).totalChecked, 0);
});

test('the last sellable unit, an expired coupon and a charge above the khata limit each block checkout', async t => {
  const request = await openShop(t);
  const before = store.read();
  const items = [{ id: 1, qty: 1 }];
  const [{ sellable }] = await request('/api/products', 200);
  assert.equal(sellable, 2);
  const stock = await request('/api/orders', 409, { items: [{ id: 1, qty: sellable }] });
  assert.match(stock.error, /2 sellable available/);
  const expired = { items, coupon: 'DIWALI20' };
  const preview = await request('/api/pricing/preview', 200, expired);
  assert.equal(preview.couponStatus.valid, false);
  assert.equal(preview.totals.total, 525);
  assert.match((await request('/api/orders', 400, expired)).error, /expired/);
  const credit = await request('/api/orders', 409, { items, paymentMode: 'khata', customerId: 1 });
  assert.match(credit.error, /credit limit exceeded/);
  assert.deepEqual(store.read(), before);
});

test('a settlement sent as form text concatenates with prior payments, while the receipt stores a number', async t => {
  const request = await openShop(t);
  const payment = await request('/api/customers/1/settle', 201, { amount: '5', mode: 'cash' });
  assert.equal(payment.settlement.amount, 5);
  const { customers, settlements } = await request('/api/customers', 200);
  assert.equal(settlements[0].amount, 5);
  assert.equal(customers[0].totalSettled, '205');
  assert.equal(customers[0].balance, -105);
});
