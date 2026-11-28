const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../config');
const dates = require('../lib/dates');
const tax = require('../lib/tax');
const coupons = require('../lib/coupons');
const pricing = require('../lib/pricing');
const inventory = require('../lib/inventory');
const ledger = require('../lib/ledger');
const orders = require('../lib/orders');
const reports = require('../lib/reports');
const invoice = require('../lib/invoice');

function fixture() {
  return {
    products: [
      { id: 1, sku: 'RICE', name: 'Rice', category: 'Staples & Grains', unit: 'kg', hsn: '1006', price: 100, stock: 20, reserved: 2, reorderLevel: 5 },
      { id: 2, sku: 'TEA', name: 'Tea', category: 'Beverages & Packaged', hsn: '0902', price: 200, stock: 8 },
      { id: 3, name: 'Legacy item', price: 10, stock: 10 }
    ],
    customers: [
      { id: 1, name: 'Asha', phone: '999', type: 'Retail', creditLimit: 1000, openingBalance: 50, totalBilled: 100, totalSettled: 25 },
      { id: 2, name: 'Bala', phone: '888', creditLimit: 100, openingBalance: 0, totalBilled: 0, totalSettled: 0 }
    ],
    orders: [], settlements: [], auditLog: [], nextOrderId: 1001, nextSettlementId: 501
  };
}

test('date normalization and fiscal year preserve legacy defaults and boundaries', () => {
  assert.equal(dates.normalizeDateKey(' 2024-04-01 '), '01/04/2024');
  assert.equal(dates.normalizeDateKey('31/03/2024'), '31/03/2024');
  assert.equal(dates.normalizeDateKey(''), '');
  assert.equal(dates.getFiscalYear('01/04/2024'), 'FY24-25');
  assert.equal(dates.getFiscalYear('31/03/2024'), 'FY23-24');
  assert.equal(dates.getFiscalYear('not a date'), 'FY21-22');
  assert.match(dates.today(), /^\d{2}\/\d{2}\/\d{4}$/);
});

test('tax resolves explicit rates, HSN slabs, fallback and GST split', () => {
  assert.equal(tax.getRateForItem(null), 0.18);
  assert.equal(tax.getRateForItem({ gstRate: 5 }), 0.05);
  assert.equal(tax.getRateForItem({ gstRate: 0.12 }), 0.12);
  assert.equal(tax.getRateForItem({ hsn: '1006' }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: 'unknown' }), 0.18);
  assert.equal(tax.getSlabPercent({ hsn: '0405' }), 12);
  assert.deepEqual(tax.splitCgstSgst(1.01), { cgst: 0.51, sgst: 0.5 });
});

test('coupon normalization, validation, caps, flat discount and active listing', () => {
  assert.equal(coupons.normalizeCode(' save10 '), 'SAVE10');
  assert.equal(coupons.normalizeCode(null), '');
  assert.equal(coupons.validate('', 10).valid, true);
  assert.equal(coupons.validate('save10', 500).discount, 50);
  assert.equal(coupons.calculateDiscount(5000, 'SAVE10'), 150);
  assert.equal(coupons.calculateDiscount(20, 'FLAT50'), 0);
  assert.equal(coupons.calculateDiscount(400, 'FLAT50'), 50);
  assert.match(coupons.validate('SAVE10', 499).error, /minimum order/);
  assert.match(coupons.validate('bad', 500).error, /Invalid coupon/);
  assert.match(coupons.validate('DIWALI20', 5000).error, /expired/);
  assert.equal(coupons.getCoupon('DIWALI20'), null);
  assert.equal(coupons.listActive().some(c => c.code === 'DIWALI20'), false);
});

test('pricing apportions cart discount and tax across HSN lines', () => {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 6 },
    { id: 2, name: 'Tea', hsn: '0902', price: 100, qty: 2 }
  ];
  assert.equal(pricing.subtotal(items), 800);
  assert.deepEqual(pricing.computeTotals(items, 'WELCOME'), {
    subtotal: 800, discount: 40, taxable: 760, tax: 62.7, cgst: 31.35, sgst: 31.35,
    total: 822.7,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 600, discount: 30, taxable: 570, tax: 28.5, net: 598.5 },
      { id: 2, name: 'Tea', hsn: '0902', gstPercent: 18, gross: 200, discount: 10, taxable: 190, tax: 34.2, net: 224.2 }
    ]
  });
  assert.equal(pricing.round2(1.005), 1.01);
});

test('inventory accounts for reservations, safety buffer, mutations and valuation', () => {
  const db = fixture();
  assert.equal(inventory.find(db.products, '1').name, 'Rice');
  assert.equal(inventory.find(db.products, 99), null);
  assert.equal(inventory.getSellableStock(db.products[0]), 18);
  assert.equal(inventory.getSellableStock(null), 0);
  assert.deepEqual(inventory.check(db.products, [{ id: 1, qty: 17 }]), { ok: true });
  assert.match(inventory.check(db.products, [{ id: 1, qty: 18 }]).msg, /out of stock/);
  assert.match(inventory.check(db.products, [{ id: 99, qty: 1 }]).msg, /Unknown product/);
  inventory.reserve(db.products, [{ id: 1, qty: 3 }]);
  assert.equal(db.products[0].stock, 17);
  inventory.release(db.products, [{ productId: 1, qty: 4 }]);
  assert.equal(db.products[0].reserved, 0);
  assert.deepEqual(inventory.summarize(db.products), { totalSkus: 3, outOfStockCount: 0, lowStockCount: 2, totalValuation: 3400 });
});

test('ledger lists balances, enforces credit, reverses debit and records settlements', () => {
  const db = fixture();
  assert.equal(ledger.listCustomers(db)[0].balance, 125);
  assert.equal(ledger.listCustomers(db)[1].type, 'Retail');
  assert.equal(ledger.chargeOrderToKhata(db, 99, 1).error, 'Customer account not found for Khata billing');
  assert.equal(ledger.chargeOrderToKhata(db, 2, 101).ok, false);
  assert.equal(ledger.chargeOrderToKhata(db, 1, 50).ok, true);
  ledger.reverseOrderDebit(db, 1, 20);
  assert.equal(db.customers[0].totalBilled, 130);
  assert.equal(ledger.recordSettlement(db, 99, 10).ok, false);
  assert.equal(ledger.recordSettlement(db, 1, 0).ok, false);
  const settled = ledger.recordSettlement(db, 1, 10, 'cash', 'paid');
  assert.equal(settled.ok, true);
  assert.equal(settled.settlement.id, 501);
  assert.equal(settled.settlement.mode, 'cash');
  assert.equal(db.settlements[0].note, 'paid');
});

test('orders add, retrieve, sort/filter, cancel, release stock and reverse khata', () => {
  const db = fixture();
  const a = orders.add(db, { date: '01/04/2024', items: [{ productId: 1, qty: 2 }], total: 20 });
  const b = orders.add(db, { date: '02/04/2024', customer: 'Asha', coupon: 'WELCOME', status: 'pending', paymentMode: 'khata', customerId: 1, items: [{ productId: 1, qty: 3 }], total: 30 });
  assert.equal(a.customer, 'Walk-in');
  assert.equal(a.status, 'completed');
  assert.equal(orders.get(db, String(b.id)), b);
  assert.deepEqual(orders.list(db, { search: 'wel', status: 'pending' }), [b]);
  assert.deepEqual(orders.list(db, { from: '2024-04-02', to: '2024-04-02' }), [b]);
  assert.equal(orders.cancel(db, 999, '').ok, false);
  assert.equal(orders.cancel(db, b.id, 'test').ok, true);
  assert.equal(b.cancelReason, 'test');
  assert.equal(db.customers[0].totalBilled, 70);
  assert.equal(orders.cancel(db, b.id).error, 'Order #' + b.id + ' is already cancelled');
});

test('invoice escapes names and reports current tax, coupon and mismatch behavior', () => {
  const html = invoice.render({ id: 7, date: 'today', customer: '<A&>', items: [{ name: '<Rice>', price: 100, qty: 1 }], total: 100 });
  assert.match(html, /&lt;A&amp;&gt;/);
  assert.match(html, /&lt;Rice&gt;/);
  assert.match(html, /Accountant Reconciliation Notice/);
  const calc = invoice.computeInvoiceFigures({ items: [{ name: 'Oil', price: 100, qty: 1, hsn: '1512' }], coupon: 'WELCOME' });
  assert.equal(calc.tax, 4.75);
  assert.equal(calc.discount, 5);
  assert.equal(calc.total, 99.75);
});

test('reports exclude cancelled revenue and reconcile active invoices', () => {
  const db = fixture();
  db.orders = [
    { id: 1, date: '01/04/2024', items: [{ name: 'Rice', price: 100, qty: 1 }], subtotal: 100, discount: 0, tax: 5, total: 105 },
    { id: 2, status: 'pending', items: [], subtotal: 0, discount: 0, tax: 0, total: 0 },
    { id: 3, status: 'cancelled', items: [], total: 999 }
  ];
  const summary = reports.getDashboardSummary(db);
  assert.equal(summary.grossRevenue, 105);
  assert.equal(summary.totalOrders, 3);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.cancelledCount, 1);
  assert.equal(summary.activeOrdersCount, 2);
  const recon = reports.getGstReconciliation(db);
  assert.equal(recon.totalChecked, 2);
  assert.equal(recon.mismatchCount, 1);
  assert.equal(recon.rows[0].orderId, 1);
});

test('store structure defaults and audit cap', () => {
  const store = require('../lib/store');
  const blank = store.__characterizationEnsureStructure ? store.__characterizationEnsureStructure({}) : null;
  if (blank) assert.deepEqual(blank, { products: [], orders: [], customers: [], settlements: [], auditLog: [], nextOrderId: 1001, nextSettlementId: 501 });
  const db = { auditLog: [] };
  for (let i = 0; i < 102; i++) store.appendAudit(db, 'ACTION', String(i));
  assert.equal(db.auditLog.length, 100);
  assert.equal(db.auditLog[0].details, '101');
});

function invoke(router, method, pathname, query, body, params) {
  const routeLayer = router.stack.find(layer => layer.route && layer.route.path === pathname && layer.route.methods[method.toLowerCase()]);
  assert.ok(routeLayer, method + ' ' + pathname + ' route exists');
  const handler = routeLayer.route.stack[0].handle;
  const req = { params: params || {}, query: query || {}, body: body || {} };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.value = value; return this; },
    send(value) { this.value = value; return this; },
    sendStatus(code) { this.statusCode = code; return this; }
  };
  handler(req, res);
  return res;
}

test('API route handlers characterize validation, pricing, admin, invoices and in-memory mutations', () => {
  const store = require('../lib/store');
  const productRoutes = require('../routes/products');
  const orderRoutes = require('../routes/orders');
  const customerRoutes = require('../routes/customers');
  const reportRoutes = require('../routes/reports');
  let db = fixture();
  const originalRead = store.read;
  const originalWrite = store.write;
  store.read = () => structuredClone(db);
  store.write = next => { db = structuredClone(next); };
  try {
  const products = p => invoke(productRoutes, 'get', '/products', p);
  const couponsRoute = () => invoke(productRoutes, 'get', '/coupons');
  const ordersRoute = (p, q, b, params) => invoke(orderRoutes, p, q, {}, b, params);
  const customersRoute = (p, q, b, params) => invoke(customerRoutes, p, q, {}, b, params);
  const report = (p, q, b) => p === 'post'
    ? invoke(reportRoutes, p, q, {}, b)
    : invoke(reportRoutes, p, q, b, {});
  assert.equal(products({ search: 'rice' }).value.length, 1);
  assert.equal(products({ category: 'unknown' }).value.length, 0);
  assert.ok(couponsRoute().value.some(c => c.code === 'SAVE10'));
  assert.equal(ordersRoute('get', '/orders').value.length, 0);
  assert.equal(ordersRoute('get', '/orders/:id', {}, { id: '999' }).statusCode, 404);
  assert.equal(ordersRoute('post', '/orders', {}).statusCode, 400);
  assert.equal(ordersRoute('post', '/orders', { items: [{ id: 999, qty: 1 }] }).statusCode, 400);
  assert.equal(ordersRoute('post', '/orders', { items: [{ id: 1, qty: 18 }] }).statusCode, 409);
  assert.equal(ordersRoute('post', '/orders', { items: [{ id: 1, qty: 1 }], coupon: 'NOPE' }).statusCode, 400);
  assert.equal(ordersRoute('post', '/orders', { items: [{ id: 1, qty: 1 }], paymentMode: 'khata' }).statusCode, 400);
  const created = ordersRoute('post', '/orders', { items: [{ id: 1, qty: 2 }], paymentMode: 'khata', customerId: 1, status: 'pending' });
  assert.equal(created.statusCode, 201);
  assert.equal(created.value.customer, 'Asha');
  assert.equal(ordersRoute('get', '/orders/:id', {}, { id: '1001' }).value.id, 1001);
  assert.equal(ordersRoute('get', '/orders', { status: 'pending', search: 'asha' }).value.length, 1);
  assert.equal(ordersRoute('post', '/orders/:id/cancel', { reason: 'dispatch issue' }, { id: '1001' }).statusCode, 200);
  assert.equal(ordersRoute('post', '/orders/:id/cancel', {}, { id: '1001' }).statusCode, 400);
  assert.equal(db.products[0].stock, 18);
  assert.ok(db.auditLog.some(entry => entry.action === 'ORDER_CANCELLED'));
  assert.equal(report('post', '/pricing/preview', { items: [{ id: 1, qty: 2 }], coupon: 'WELCOME' }).value.totals.subtotal, 200);
  assert.equal(report('post', '/pricing/preview', { items: [{ id: 999, qty: 2 }], coupon: 'NOPE' }).value.totals.subtotal, 0);
  assert.equal(customersRoute('get', '/customers').value.customers.length, 2);
  assert.equal(customersRoute('post', '/customers/:id/settle', { amount: 10 }, { id: '999' }).statusCode, 400);
  assert.equal(customersRoute('post', '/customers/:id/settle', { amount: 10 }, { id: '1' }).statusCode, 201);
  assert.equal(report('get', '/reports/dashboard').value.summary.totalOrders, 1);
  assert.equal(report('get', '/reports/gst-reconciliation').value.totalChecked, 0);
  assert.equal(report('get', '/admin/export', { key: 'wrong' }).statusCode, 403);
  assert.ok(report('get', '/admin/export', { key: config.adminKey }).value.products);
  const server = require('../server');
  const invoiceLayer = server._router.stack.find(layer => layer.route && layer.route.path === '/orders/:id/invoice');
  assert.ok(invoiceLayer);
  const invoiceRes = { statusCode: 200, status(code) { this.statusCode = code; return this; }, send(value) { this.value = value; } };
  invoiceLayer.route.stack[0].handle({ params: { id: '1001' } }, invoiceRes);
  assert.equal(invoiceRes.statusCode, 200);
  assert.match(invoiceRes.value, /Tax Invoice #1001/);
  const missingInvoice = { statusCode: 200, status(code) { this.statusCode = code; return this; }, send(value) { this.value = value; } };
  invoiceLayer.route.stack[0].handle({ params: { id: '9999' } }, missingInvoice);
  assert.equal(missingInvoice.statusCode, 404);
  const fs = require('node:fs');
  const path = require('node:path');
  const page = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const browserCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  const stylesheet = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');
  assert.match(page, /ShopLedger/);
  assert.match(page, /id="view-new"/);
  assert.match(page, /id="view-orders"/);
  assert.match(page, /id="view-khata"/);
  assert.match(page, /id="view-audit"/);
  assert.match(browserCode, /window\.cancelOrder/);
  assert.match(browserCode, /window\.stepQty/);
  assert.match(browserCode, /window\.onQtyInput/);
  assert.match(browserCode, /btn-record-settlement/);
  assert.match(stylesheet, /\.panel/);
  assert.ok(db.auditLog.some(entry => entry.action === 'ORDER_CREATED'));
  } finally {
    store.read = originalRead;
    store.write = originalWrite;
  }
});
