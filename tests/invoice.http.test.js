'use strict';

const store = require('./helpers/guard-store');
const test = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./fixtures/orders.json');
const app = require('../server');

let server;
let origin;
let db;
let writes;
const guardedRead = store.read;
const guardedWrite = store.write;

test.before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
});

test.beforeEach(() => {
  db = {
    orders: structuredClone(fixtures),
    products: [
      { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 640, stock: 20, reserved: 0 },
      { id: 4, sku: 'OIL-001', name: 'Sunflower Oil', hsn: '1512', price: 190, stock: 20, reserved: 0 }
    ],
    customers: [], settlements: [], auditLog: [], nextOrderId: 1009
  };
  writes = 0;
  store.read = () => structuredClone(db);
  store.write = value => { db = structuredClone(value); writes++; };
});

test.afterEach(() => {
  store.read = guardedRead;
  store.write = guardedWrite;
});

test.after(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});

function get(path) { return fetch(origin + path); }
function post(path, body) {
  return fetch(origin + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}

test('HTTP: real printable endpoint returns correct #1002 tax and no false warning', async () => {
  const response = await get('/orders/1002/invoice');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  const html = await response.text();
  for (const text of ['INV-1002', '₹963.90', '₹28.80', '₹17.10', '₹918.00']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Accountant Reconciliation Notice'));
  assert.equal(writes, 0);
});

test('HTTP: all eight existing orders have zero amount and GST differences', async () => {
  const response = await get('/api/reports/gst-reconciliation');
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.totalChecked, 8);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.ok(result.rows.every(row => row.matched && row.delta === 0 && row.invoiceTax === row.ledgerTax));
  const capped = result.rows.find(row => row.orderId === 1004);
  assert.equal(capped.invoiceDiscount, 150);
  assert.equal(capped.invoiceTotal, 2194.5);
  assert.equal(writes, 0);
});

test('HTTP: dashboard receives the corrected audit results without changing ledger revenue', async () => {
  const response = await get('/api/reports/dashboard');
  assert.equal(response.status, 200);
  const { summary } = await response.json();
  assert.equal(summary.reconciliationMismatchCount, 0);
  assert.equal(summary.reconciliationTotalDelta, 0);
  assert.equal(summary.grossRevenue, 8578.72);
  assert.equal(writes, 0);
});

test('HTTP: pricing preview remains correct and never persists data', async () => {
  const response = await post('/api/pricing/preview', {
    items: [{ id: 1, qty: 1 }, { id: 4, qty: 2 }], coupon: 'SAVE10'
  });
  assert.equal(response.status, 200);
  const { totals } = await response.json();
  assert.deepEqual([totals.discount, totals.tax, totals.total], [102, 45.9, 963.9]);
  assert.equal(writes, 0);
});

test('HTTP: create order -> print invoice -> audit remains balanced using only the in-memory store', async () => {
  const response = await post('/api/orders', {
    items: [{ id: 1, qty: 1, price: 0.01 }, { id: 4, qty: 2 }],
    customer: 'QA Fixture', paymentMode: 'cash', coupon: ' save10 '
  });
  assert.equal(response.status, 201);
  const order = await response.json();
  assert.equal(order.id, 1009);
  assert.deepEqual([order.subtotal, order.discount, order.tax, order.total], [1020, 102, 45.9, 963.9]);
  assert.equal(db.products[0].stock, 19);
  assert.equal(db.products[1].stock, 18);
  assert.equal(writes, 1);
  const invoiceResponse = await get('/orders/1009/invoice');
  const html = await invoiceResponse.text();
  assert.match(html, /₹963\.90/);
  assert.ok(!html.includes('Accountant Reconciliation Notice'));
  const audit = await (await get('/api/reports/gst-reconciliation')).json();
  assert.equal(audit.totalChecked, 9);
  assert.equal(audit.mismatchCount, 0);
});

test('HTTP: missing printable invoice returns 404', async () => {
  const response = await get('/orders/9999/invoice');
  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'Order not found');
  assert.equal(writes, 0);
});

test('HTTP: missing order API returns 404', async () => {
  assert.equal((await get('/api/orders/9999')).status, 404);
});

test('HTTP: invalid coupon is rejected without persisting an order', async () => {
  const response = await post('/api/orders', { items: [{ id: 1, qty: 1 }], coupon: 'INVALID' });
  assert.equal(response.status, 400);
  assert.equal(writes, 0);
});

test('HTTP: empty order is rejected without a write', async () => {
  assert.equal((await post('/api/orders', { items: [] })).status, 400);
  assert.equal(writes, 0);
});

test('HTTP: unknown product is rejected without a write', async () => {
  assert.equal((await post('/api/orders', { items: [{ id: 999, qty: 1 }] })).status, 400);
  assert.equal(writes, 0);
});

test('HTTP: insufficient stock keeps the existing rejection contract', async () => {
  assert.equal((await post('/api/orders', { items: [{ id: 1, qty: 100 }] })).status, 409);
  assert.equal(writes, 0);
});

test('HTTP: genuine ledger discrepancy is still visible in HTML and reconciliation', async () => {
  db.orders[1].total = 900;
  const html = await (await get('/orders/1002/invoice')).text();
  assert.match(html, /Accountant Reconciliation Notice/);
  const audit = await (await get('/api/reports/gst-reconciliation')).json();
  assert.equal(audit.mismatchCount, 1);
  assert.equal(audit.rows.find(row => row.orderId === 1002).delta, 63.9);
});

test('HTTP: item and customer HTML is escaped by the actual invoice endpoint', async () => {
  db.orders[1].customer = '<script>customer()</script>';
  db.orders[1].items[0].name = '<img src=x onerror=attack()>';
  const html = await (await get('/orders/1002/invoice')).text();
  assert.ok(!html.includes('<script>customer()</script>'));
  assert.ok(!html.includes('<img src=x onerror=attack()>'));
  assert.ok(html.includes('&lt;img src=x onerror=attack()&gt;'));
});

test('HTTP: original UI and JavaScript/CSS assets are still served', async () => {
  const response = await get('/');
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const tab of ['tab-new', 'tab-orders', 'tab-khata', 'tab-audit']) assert.ok(html.includes(tab));
  assert.equal((await get('/js/app.js')).status, 200);
  assert.equal((await get('/css/style.css')).status, 200);
});

test('HTTP: admin export without a key remains forbidden', async () => {
  assert.equal((await get('/api/admin/export')).status, 403);
  assert.equal(writes, 0);
});
