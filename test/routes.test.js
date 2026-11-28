const assert = require('node:assert/strict');
const { test } = require('node:test');
const app = require('../server');
const config = require('../config');
const store = require('../lib/store');
const customers = require('../routes/customers');
const orders = require('../routes/orders');
const products = require('../routes/products');
const reports = require('../routes/reports');

function fixture() {
  return {
    products: [
      { id: 1, name: 'Rice', sku: 'RICE-1', category: 'Grains', hsn: '1006', price: 100, stock: 10, reserved: 2 },
      { id: 2, name: 'Tea', hsn: '0902', price: 200, stock: 6 }
    ],
    customers: [
      { id: 7, name: 'Test Account', openingBalance: 25, totalBilled: 75, totalSettled: 50, creditLimit: 1000 }
    ],
    orders: [],
    settlements: [],
    auditLog: [],
    nextOrderId: 1001,
    nextSettlementId: 501
  };
}

function useMemoryStore(t, initial = fixture()) {
  let db = structuredClone(initial);
  let writes = 0;
  t.mock.method(store, 'read', () => structuredClone(db));
  t.mock.method(store, 'write', next => {
    db = JSON.parse(JSON.stringify(next));
    writes++;
  });
  return { get state() { return db; }, get writes() { return writes; } };
}

// Dispatch a registered route with request and response doubles, without opening a socket.
function dispatch(router, method, path, request = {}) {
  const stack = router.stack || router._router.stack;
  const layer = stack.find(entry => entry.route?.path === path && entry.route.methods[method]);
  assert.ok(layer, method.toUpperCase() + ' ' + path + ' must be registered');

  const req = { method: method.toUpperCase(), query: {}, params: {}, ...request };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; },
    json(body) { return this.send(body); },
    sendStatus(code) { return this.status(code); }
  };

  layer.route.dispatch(req, res, error => assert.ifError(error));
  return { status: res.statusCode, body: res.body };
}

test('Express installs JSON and static middleware and mounts all four routers under /api', () => {
  const stack = app._router.stack;
  assert.ok(stack.some(layer => layer.name === 'jsonParser'));
  assert.ok(stack.some(layer => layer.name === 'serveStatic'));

  for (const router of [products, orders, customers, reports]) {
    const mount = stack.find(layer => layer.handle === router);
    assert.ok(mount);
    assert.equal(mount.regexp.test('/api/products'), true);
    assert.equal(mount.regexp.test('/products'), false);
  }
});

test('product routes expose sellable units, catalog defaults, filters, and active coupons', t => {
  const memory = useMemoryStore(t);
  const filtered = dispatch(products, 'get', '/products', { query: { category: 'GRAINS', search: '1006 ' } });

  assert.deepEqual(filtered, {
    status: 200,
    body: [{
      id: 1, name: 'Rice', sku: 'RICE-1', category: 'Grains', unit: 'unit', hsn: '1006',
      gstPercent: 5, price: 100, stock: 10, reserved: 2, sellable: 8, reorderLevel: 10
    }]
  });
  const all = dispatch(products, 'get', '/products').body;
  assert.equal(all[1].sku, 'SKU-2');
  assert.equal(all[1].category, 'General');
  assert.equal(all[1].reserved, 0);
  const active = dispatch(products, 'get', '/coupons').body;
  assert.deepEqual(active.map(coupon => coupon.code), ['SAVE10', 'FLAT50', 'WELCOME', 'WHOLESALE15']);
  assert.equal(memory.writes, 0);
});

test('placing a pending Khata order stores catalog prices, totals, stock, credit, and an audit entry', t => {
  const memory = useMemoryStore(t);
  const result = dispatch(orders, 'post', '/orders', {
    body: {
      items: [{ id: '1', qty: '6', price: 1 }], customerId: '7', customer: 'Ignored name',
      paymentMode: 'KHATA', status: 'pending', coupon: ' save10 '
    }
  });
  const { date, ...order } = result.body;

  assert.equal(result.status, 201);
  assert.match(date, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.deepEqual(order, {
    id: 1001, customer: 'Test Account', customerId: 7, paymentMode: 'khata', status: 'pending',
    items: [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 6 }],
    coupon: 'SAVE10', subtotal: 600, discount: 60, tax: 27, total: 567
  });
  assert.deepEqual(memory.state.orders, [result.body]);
  assert.equal(memory.state.products[0].stock, 4);
  assert.equal(memory.state.products[0].reserved, 2);
  assert.equal(memory.state.customers[0].totalBilled, 642);
  assert.equal(memory.state.customers[0].balance, 617);
  assert.equal(memory.state.nextOrderId, 1002);
  assert.equal(memory.state.auditLog[0].action, 'ORDER_CREATED');
  assert.equal(memory.writes, 1);
});

test('order creation errors leave the saved state and counters intact', t => {
  const initial = fixture();
  initial.customers[0].creditLimit = 100;
  const memory = useMemoryStore(t, initial);
  const rice = [{ id: 1, qty: 1 }];
  const failures = [
    { body: {}, status: 400, error: /Pick at least one item/ },
    { body: { items: [{ id: 99, qty: 1 }] }, status: 400, error: /Unknown product ID 99/ },
    { body: { items: [{ id: 1, qty: 8 }] }, status: 409, error: /out of stock/ },
    { body: { items: rice, coupon: 'save10' }, status: 400, error: /minimum order subtotal/ },
    { body: { items: rice, paymentMode: 'khata' }, status: 400, error: /registered Khata customer/ },
    { body: { items: rice, paymentMode: 'khata', customerId: 7 }, status: 409, error: /credit limit exceeded/ }
  ];

  for (const { body, status, error } of failures) {
    const result = dispatch(orders, 'post', '/orders', { body });
    assert.equal(result.status, status);
    assert.match(result.body.error, error);
  }
  assert.deepEqual(memory.state, initial);
  assert.equal(memory.writes, 0);
});

test('CURRENT BEHAVIOUR: order placement converts an invalid quantity to one', t => {
  useMemoryStore(t);
  const result = dispatch(orders, 'post', '/orders', { body: { items: [{ id: 1, qty: 'bad' }] } });

  assert.equal(result.status, 201);
  assert.equal(result.body.items[0].qty, 1);
  assert.equal(result.body.total, 105);
});

test('order routes support search, lookup, and audited cancellation', t => {
  const initial = fixture();
  initial.orders.push(
    { id: 201, date: '01/02/2024', customer: 'Test Account', status: 'pending', items: [] },
    { id: 202, date: '02/02/2024', customer: 'Walk-in', status: 'completed', items: [] }
  );
  const memory = useMemoryStore(t, initial);
  const filtered = dispatch(orders, 'get', '/orders', { query: { status: 'pending', search: 'test' } });
  assert.deepEqual(filtered.body, [initial.orders[0]]);
  assert.deepEqual(dispatch(orders, 'get', '/orders/:id', { params: { id: '202' } }).body, initial.orders[1]);
  assert.deepEqual(dispatch(orders, 'get', '/orders/:id', { params: { id: '99' } }), {
    status: 404, body: { error: 'Order not found' }
  });

  const request = { params: { id: '201' } };
  const cancelled = dispatch(orders, 'post', '/orders/:id/cancel', request);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.status, 'cancelled');
  assert.equal(cancelled.body.cancelReason, 'Cancelled from order desk');
  assert.equal(memory.state.auditLog[0].action, 'ORDER_CANCELLED');
  assert.equal(dispatch(orders, 'post', '/orders/:id/cancel', request).status, 400);
  assert.equal(memory.writes, 1);
});

test('customer routes limit the settlement feed and write a valid settlement with an audit entry', t => {
  const initial = fixture();
  initial.settlements = Array.from({ length: 30 }, (_, index) => ({ id: 500 - index }));
  const memory = useMemoryStore(t, initial);
  const listed = dispatch(customers, 'get', '/customers').body;
  assert.equal(listed.customers[0].balance, 50);
  assert.equal(listed.settlements.length, 25);
  assert.deepEqual(listed.settlements[0], { id: 500 });

  const params = { id: '7' };
  assert.equal(dispatch(customers, 'post', '/customers/:id/settle', { params, body: { amount: 0 } }).status, 400);
  const settled = dispatch(customers, 'post', '/customers/:id/settle', {
    params, body: { amount: 20, mode: 'cash', note: 'Partial payment' }
  });
  assert.equal(settled.status, 201);
  assert.equal(settled.body.customer.balance, 30);
  assert.equal(memory.state.settlements[0].amount, 20);
  assert.equal(memory.state.settlements[0].note, 'Partial payment');
  assert.equal(memory.state.auditLog[0].action, 'KHATA_SETTLEMENT');
  assert.equal(memory.writes, 1);
});

test('CURRENT BEHAVIOUR: preview keeps fractional quantities, skips unknown products, and returns totals for an invalid coupon', t => {
  const memory = useMemoryStore(t);
  const preview = dispatch(reports, 'post', '/pricing/preview', {
    body: { items: [{ id: 1, qty: 1.5 }, { id: 99, qty: 1 }, { id: 2, qty: 0 }], coupon: 'save10' }
  });

  assert.equal(preview.status, 200);
  assert.equal(preview.body.couponStatus.valid, false);
  assert.deepEqual(preview.body.totals.lines.map(line => line.id), [1]);
  assert.equal(preview.body.totals.subtotal, 150);
  assert.equal(preview.body.totals.discount, 0);
  assert.equal(preview.body.totals.tax, 7.5);
  assert.equal(preview.body.totals.total, 157.5);
  assert.equal(memory.writes, 0);
});

test('report routes return dashboard, reconciliation, and gated export responses', t => {
  const initial = fixture();
  initial.auditLog = Array.from({ length: 15 }, (_, index) => ({ action: 'TEST_' + index }));
  const memory = useMemoryStore(t, initial);
  const dashboard = dispatch(reports, 'get', '/reports/dashboard').body;

  assert.equal(dashboard.shop.name, config.shop.name);
  assert.equal(dashboard.summary.totalOrders, 0);
  assert.deepEqual(dashboard.recentAudit, initial.auditLog.slice(0, 12));
  assert.deepEqual(dispatch(reports, 'get', '/reports/gst-reconciliation').body, {
    totalChecked: 0, mismatchCount: 0, totalDelta: 0, rows: []
  });
  assert.equal(dispatch(reports, 'get', '/admin/export').status, 403);
  assert.deepEqual(dispatch(reports, 'get', '/admin/export', { query: { key: config.adminKey } }), {
    status: 200, body: initial
  });
  assert.equal(memory.writes, 0);
});

test('the printable invoice route serves HTML for a saved order and 404 for a missing order', t => {
  const initial = fixture();
  initial.orders.push({
    id: 201, date: '01/02/2024', items: [{ name: 'Tea', hsn: '0902', price: 200, qty: 1 }], total: 236
  });
  const memory = useMemoryStore(t, initial);
  const html = dispatch(app, 'get', '/orders/:id/invoice', { params: { id: '201' } });

  assert.equal(html.status, 200);
  assert.match(html.body, /INV-201/);
  assert.match(html.body, /₹236\.00/);
  assert.deepEqual(dispatch(app, 'get', '/orders/:id/invoice', { params: { id: '99' } }), {
    status: 404, body: 'Order not found'
  });
  assert.equal(memory.writes, 0);
});
