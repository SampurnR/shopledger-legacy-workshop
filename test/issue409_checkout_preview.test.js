var test = require('node:test');
var assert = require('node:assert/strict');
var http = require('node:http');
var fs = require('node:fs');
var path = require('node:path');
var vm = require('node:vm');

// Stub lib/store strictly in memory before requiring server.js (never touch data/db.json)
var store = require('../lib/store');
var invoice = require('../lib/invoice');
var origRead = store.read;
var origWrite = store.write;

var memDb = null;

function createMemDb(overrides) {
  var base = {
    nextOrderId: 2001,
    nextSettlementId: 601,
    products: [
      {
        id: 1,
        sku: 'GRN-001',
        name: 'Indrayani Basmati Rice 5kg',
        category: 'Staples & Grains',
        unit: 'bag',
        hsn: '1006',
        price: 640,
        stock: 10,
        reserved: 0,
        reorderLevel: 3
      },
      {
        id: 2,
        sku: 'SPC-002',
        name: 'Special Batch Spice Mix',
        category: 'Oils & Spices',
        unit: 'pack',
        hsn: '1006',
        gstRate: 12,
        price: 500,
        stock: 10,
        reserved: 0,
        reorderLevel: 3
      },
      {
        id: 3,
        sku: 'ZRO-003',
        name: 'Zero-Rated Staple Salt',
        category: 'Staples & Grains',
        unit: 'pack',
        hsn: '1006',
        gstRate: 0,
        price: 100,
        stock: 10,
        reserved: 0,
        reorderLevel: 3
      }
    ],
    orders: [],
    customers: [
      {
        id: 1,
        name: 'Meera Joshi',
        phone: '9876543210',
        type: 'Retail',
        gstin: '',
        creditLimit: 5000,
        openingBalance: 0,
        totalBilled: 0,
        totalSettled: 0,
        balance: 0
      }
    ],
    settlements: [],
    auditLog: []
  };
  if (overrides) {
    Object.keys(overrides).forEach(function (k) {
      base[k] = overrides[k];
    });
  }
  return base;
}

store.read = function () {
  return memDb;
};
store.write = function (nextDb) {
  memDb = nextDb;
};

var app = require('../server');
var server = null;
var baseUrl = '';

function requestJson(method, urlPath, body, headers) {
  return new Promise(function (resolve, reject) {
    var payload = body !== undefined ? JSON.stringify(body) : null;
    var reqHeaders = Object.assign({}, headers || {});
    if (payload !== null) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    var req = http.request(baseUrl + urlPath, {
      method: method,
      headers: reqHeaders
    }, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var raw = Buffer.concat(chunks).toString('utf8');
        var parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch (e) {
          parsed = raw;
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload !== null) req.write(payload);
    req.end();
  });
}

function createUiSandbox() {
  var elements = {};
  var xhrLog = [];

  function makeEl(id) {
    if (!elements[id]) {
      elements[id] = {
        id: id,
        value: '',
        textContent: '',
        innerHTML: '',
        className: '',
        disabled: false,
        style: {},
        onclick: null,
        onchange: null,
        oninput: null,
        focus: function () {},
        getAttribute: function () { return ''; }
      };
    }
    return elements[id];
  }

  var ids = [
    'kpi-revenue', 'kpi-tax', 'kpi-orders', 'kpi-orders-sub', 'kpi-khata',
    'kpi-stock', 'kpi-stock-sub', 'badge-orders', 'recon-alert-btn',
    'recon-alert-text', 'badge-audit', 'pos-search', 'cart-count',
    'cart-items-list', 'coupon-feedback', 'coupon', 'preview-subtotal',
    'preview-discount', 'preview-tax', 'preview-total', 'customer-select',
    'settle-customer', 'orders-search', 'orders-status', 'orders-from',
    'orders-to', 'orders-action-msg', 'settlements-list', 'settle-amount',
    'recon-summary-pill', 'view-new', 'view-orders', 'view-khata',
    'view-audit', 'tab-new', 'tab-orders', 'tab-khata', 'tab-audit',
    'walkin-name-group', 'clear-cart', 'customer', 'msg', 'place',
    'payment-mode', 'order-status', 'btn-filter-orders', 'btn-reset-orders',
    'btn-record-settlement', 'settle-mode', 'settle-note', 'khata-msg'
  ];
  for (var i = 0; i < ids.length; i++) {
    makeEl(ids[i]);
  }
  elements['payment-mode'].value = 'cash';
  elements['order-status'].value = 'completed';

  var selectors = {
    '#products tbody': makeEl('products-tbody'),
    '#orders tbody': makeEl('orders-tbody'),
    '#customers-table tbody': makeEl('customers-tbody'),
    '#inventory-audit-table tbody': makeEl('inv-tbody'),
    '#recon-table tbody': makeEl('recon-tbody')
  };

  function FakeXHR() {
    this.headers = {};
    this.status = 0;
    this.responseText = '';
    this.onload = null;
    this.onerror = null;
    this.onabort = null;
  }
  FakeXHR.prototype.open = function (method, url) {
    this.method = method;
    this.url = url;
  };
  FakeXHR.prototype.setRequestHeader = function (k, v) {
    this.headers[k] = v;
  };
  FakeXHR.prototype.send = function (body) {
    this.body = body ? JSON.parse(body) : null;
    xhrLog.push(this);
  };

  var sandbox = {
    console: console,
    Math: Math,
    Number: Number,
    String: String,
    Array: Array,
    Object: Object,
    JSON: JSON,
    Date: Date,
    XMLHttpRequest: FakeXHR,
    encodeURIComponent: encodeURIComponent,
    document: {
      getElementById: function (id) { return makeEl(id); },
      querySelector: function (sel) { return selectors[sel] || makeEl(sel); },
      querySelectorAll: function () { return []; }
    }
  };
  sandbox.window = sandbox;

  var code = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  vm.runInNewContext(code, sandbox);

  return {
    sandbox: sandbox,
    elements: elements,
    selectors: selectors,
    xhrLog: xhrLog
  };
}

test.before(function (_, done) {
  memDb = createMemDb();
  server = http.createServer(app);
  server.listen(0, '127.0.0.1', function () {
    var addr = server.address();
    baseUrl = 'http://127.0.0.1:' + addr.port;
    done();
  });
});

test.after(function (_, done) {
  store.read = origRead;
  store.write = origWrite;
  if (server) {
    if (server.closeAllConnections) server.closeAllConnections();
    server.close(done);
  } else {
    done();
  }
});

test.beforeEach(function () {
  memDb = createMemDb();
});

// ---------------------------------------------------------------------------
// 1. Duplicate Checkout Prevention (POST /api/orders)
// Prior characterization: 2s unkeyed recentSubmissions ignored Idempotency-Key,
// blocked distinct sequential orders within 2s, and poisoned retries after 400.
// ---------------------------------------------------------------------------

test('Duplicate checkout: concurrent and sequential retries with same Idempotency-Key create only 1 order, 1 stock deduction, and 1 Khata charge', async function () {
  var payload = {
    items: [{ id: 1, qty: 2 }],
    paymentMode: 'khata',
    customerId: 1
  };
  var results = await Promise.all([
    requestJson('POST', '/api/orders', payload, { 'Idempotency-Key': 'dup-key-1' }),
    requestJson('POST', '/api/orders', payload, { 'Idempotency-Key': 'dup-key-1' })
  ]);

  assert.equal(results[0].status, 201);
  assert.equal(results[1].status, 201);
  assert.equal(results[0].body.id, results[1].body.id);
  assert.equal(memDb.orders.length, 1);
  assert.equal(memDb.products[0].stock, 8);
  assert.equal(memDb.customers[0].totalBilled, results[0].body.total);
  assert.equal(memDb.customers[0].balance, results[0].body.total);

  // Sequential retry via body.idempotencyKey and body.clientRequestId also replays without extra mutations
  var payloadBodyKey = {
    items: [{ id: 2, qty: 1 }],
    paymentMode: 'cash',
    idempotencyKey: 'body-key-1'
  };
  var b1 = await requestJson('POST', '/api/orders', payloadBodyKey);
  var b2 = await requestJson('POST', '/api/orders', payloadBodyKey);
  assert.equal(b1.status, 201);
  assert.equal(b2.status, 201);
  assert.equal(b1.body.id, b2.body.id);
  assert.equal(memDb.orders.length, 2);
  assert.equal(memDb.products[1].stock, 9);

  var payloadClientReq = {
    items: [{ id: 3, qty: 1 }],
    paymentMode: 'cash',
    clientRequestId: 'client-req-1'
  };
  var c1 = await requestJson('POST', '/api/orders', payloadClientReq);
  var c2 = await requestJson('POST', '/api/orders', payloadClientReq);
  assert.equal(c1.status, 201);
  assert.equal(c2.status, 201);
  assert.equal(c1.body.id, c2.body.id);
  assert.equal(memDb.orders.length, 3);
  assert.equal(memDb.products[2].stock, 9);
});

test('Duplicate checkout: reusing same Idempotency-Key with a different payload returns 409 without mutating db', async function () {
  var first = await requestJson('POST', '/api/orders', {
    items: [{ id: 1, qty: 1 }],
    paymentMode: 'cash'
  }, { 'Idempotency-Key': 'mismatch-key-1' });
  assert.equal(first.status, 201);

  var second = await requestJson('POST', '/api/orders', {
    items: [{ id: 2, qty: 1 }],
    paymentMode: 'cash'
  }, { 'Idempotency-Key': 'mismatch-key-1' });
  assert.equal(second.status, 409);
  assert.equal(memDb.orders.length, 1);
  assert.equal(memDb.products[1].stock, 10);
});

test('Duplicate checkout: distinct sequential orders succeed and failed attempts (400/409) do not poison retries', async function () {
  var badCoupon = await requestJson('POST', '/api/orders', {
    items: [{ id: 1, qty: 1 }],
    paymentMode: 'cash',
    coupon: 'BOGUS'
  }, { 'Idempotency-Key': 'retry-after-fail' });
  assert.equal(badCoupon.status, 400);
  assert.equal(memDb.orders.length, 0);

  // Fixing coupon with same key now succeeds
  var fixed = await requestJson('POST', '/api/orders', {
    items: [{ id: 1, qty: 1 }],
    paymentMode: 'cash'
  }, { 'Idempotency-Key': 'retry-after-fail' });
  assert.equal(fixed.status, 201);
  assert.equal(memDb.orders.length, 1);

  // Distinct key (or unkeyed) sequential identical payload succeeds immediately
  var secondOrder = await requestJson('POST', '/api/orders', {
    items: [{ id: 1, qty: 1 }],
    paymentMode: 'cash'
  }, { 'Idempotency-Key': 'second-distinct-key' });
  assert.equal(secondOrder.status, 201);
  assert.equal(memDb.orders.length, 2);
  assert.equal(memDb.products[0].stock, 8);
});

// ---------------------------------------------------------------------------
// 2. UI Checkout Double-Submit Guard, Idempotency Key & Khata Formatting
// Prior characterization: public/js/app.js lacked isPlacingOrder, onerror,
// idempotencyKey lifecycle, and formatted totalSettled with String().
// ---------------------------------------------------------------------------

test('UI checkout: #place blocks re-entry, sends idempotencyKey, recovers on onerror, and resets key appropriately', function () {
  var ui = createUiSandbox();
  ui.sandbox.allProducts = [
    { id: 1, name: 'Rice', price: 640, sku: 'GRN-001', hsn: '1006', gstPercent: 5, stock: 10 }
  ];
  ui.sandbox.stepQty(1, 1);
  ui.xhrLog.length = 0;

  // Double-click while in flight (and even if disabled is bypassed)
  ui.elements.place.onclick();
  assert.equal(ui.elements.place.disabled, true);
  ui.elements.place.onclick();
  ui.elements.place.disabled = false; // attempt bypass while isPlacingOrder === true
  ui.elements.place.onclick();
  assert.equal(ui.xhrLog.length, 1);

  var firstXhr = ui.xhrLog[0];
  assert.equal(firstXhr.url, '/api/orders');
  var firstKey = firstXhr.body.idempotencyKey;
  assert.ok(firstKey && typeof firstKey === 'string');
  assert.equal(firstXhr.headers['Idempotency-Key'], firstKey);

  // Simulate network failure -> button re-enables and same key is preserved on retry
  firstXhr.onerror();
  assert.equal(ui.elements.place.disabled, false);
  ui.elements.place.onclick();
  assert.equal(ui.xhrLog.length, 2);
  var retryXhr = ui.xhrLog[1];
  assert.equal(retryXhr.body.idempotencyKey, firstKey);
  assert.equal(retryXhr.headers['Idempotency-Key'], firstKey);

  // Simulate 5xx -> same key preserved on next retry
  retryXhr.status = 503;
  retryXhr.responseText = JSON.stringify({ error: 'Temporary outage' });
  retryXhr.onload();
  assert.equal(ui.elements.place.disabled, false);
  ui.elements.place.onclick();
  assert.equal(ui.xhrLog.length, 3);
  assert.equal(ui.xhrLog[2].body.idempotencyKey, firstKey);

  // Simulate 4xx -> button re-enables and key resets for next attempt
  ui.xhrLog[2].status = 409;
  ui.xhrLog[2].responseText = JSON.stringify({ error: 'Out of stock' });
  ui.xhrLog[2].onload();
  assert.equal(ui.elements.place.disabled, false);
  ui.elements.place.onclick();
  assert.equal(ui.xhrLog.length, 4);
  var keyAfter4xx = ui.xhrLog[3].body.idempotencyKey;
  assert.notEqual(keyAfter4xx, firstKey);

  // Simulate 201 -> cart clears and next order gets a brand-new key
  ui.xhrLog[3].status = 201;
  ui.xhrLog[3].responseText = JSON.stringify({ id: 2001, total: 672 });
  ui.xhrLog[3].onload();
  assert.equal(ui.elements.place.disabled, false);

  ui.sandbox.stepQty(1, 1);
  ui.xhrLog.length = 0;
  ui.elements.place.onclick();
  assert.equal(ui.xhrLog.length, 1);
  assert.notEqual(ui.xhrLog[0].body.idempotencyKey, keyAfter4xx);
  ui.xhrLog[0].status = 201;
  ui.xhrLog[0].responseText = JSON.stringify({ id: 2002, total: 672 });
  ui.xhrLog[0].onload();
});

test('UI Khata table: formats c.totalSettled with fmtMoney', function () {
  var ui = createUiSandbox();
  ui.sandbox.renderKhataTable([{
    id: 1,
    name: 'Meera',
    phone: '999',
    type: 'Retail',
    creditLimit: 5000,
    openingBalance: 0,
    totalBilled: 1200,
    totalSettled: 1200,
    balance: 0
  }], []);
  assert.equal(ui.selectors['#customers-table tbody'].innerHTML.indexOf('₹1200.00') !== -1, true);
});

// ---------------------------------------------------------------------------
// 3. Quantity Validation Alignment (POST /api/pricing/preview & POST /api/orders)
// Prior characterization: preview skipped qty <= 0 with 200 and billed 1.5;
// orders truncated 1.5 and '1abc' to 1 via parseInt.
// ---------------------------------------------------------------------------

test('Quantity validation: both preview and checkout reject invalid quantities with 400 without mutating db', async function () {
  var badValues = [0, -1, 1.5, '1.5', '1abc', 'abc', '', null, undefined, true, false];
  for (var i = 0; i < badValues.length; i++) {
    var qtyVal = badValues[i];
    var item = qtyVal === undefined ? { id: 1 } : { id: 1, qty: qtyVal };

    var prevRes = await requestJson('POST', '/api/pricing/preview', { items: [item] });
    assert.equal(prevRes.status, 400, 'preview should reject qty=' + String(qtyVal));
    assert.ok(prevRes.body && prevRes.body.error);

    var ordRes = await requestJson('POST', '/api/orders', {
      items: [item],
      paymentMode: 'khata',
      customerId: 1
    });
    assert.equal(ordRes.status, 400, 'orders should reject qty=' + String(qtyVal));
    assert.ok(ordRes.body && ordRes.body.error);
  }

  // Non-array items rejected on both endpoints; unknown product rejected on preview too
  var nonArrPrev = await requestJson('POST', '/api/pricing/preview', { items: 'bad' });
  assert.equal(nonArrPrev.status, 400);
  var unkPrev = await requestJson('POST', '/api/pricing/preview', { items: [{ id: 999, qty: 1 }] });
  assert.equal(unkPrev.status, 400);

  assert.equal(memDb.orders.length, 0);
  assert.equal(memDb.products[0].stock, 10);
  assert.equal(memDb.customers[0].totalBilled, 0);
  assert.equal(memDb.customers[0].balance, 0);

  // Valid positive integer quantities (number and clean numeric string) succeed
  var goodPrev = await requestJson('POST', '/api/pricing/preview', { items: [{ id: 1, qty: '2' }] });
  assert.equal(goodPrev.status, 200);
  assert.equal(goodPrev.body.totals.subtotal, 1280);

  var goodOrd = await requestJson('POST', '/api/orders', { items: [{ id: 1, qty: '2' }], paymentMode: 'cash' });
  assert.equal(goodOrd.status, 201);
  assert.equal(goodOrd.body.items[0].qty, 2);
  assert.equal(memDb.products[0].stock, 8);
});

// ---------------------------------------------------------------------------
// 4. Invalid Initial Status Check (POST /api/orders)
// Prior characterization: falsy values ('', 0, false) bypassed status check.
// ---------------------------------------------------------------------------

test('Initial status validation: rejects invalid initial statuses with 400 before Khata or stock mutation', async function () {
  var invalidStatuses = ['cancelled', 'bogus', 'shipped', '', 0, false];
  for (var i = 0; i < invalidStatuses.length; i++) {
    var st = invalidStatuses[i];
    var res = await requestJson('POST', '/api/orders', {
      items: [{ id: 1, qty: 2 }],
      paymentMode: 'khata',
      customerId: 1,
      status: st
    });
    assert.equal(res.status, 400, 'status=' + JSON.stringify(st) + ' should return 400');
    assert.ok(res.body && res.body.error);
  }

  assert.equal(memDb.orders.length, 0);
  assert.equal(memDb.products[0].stock, 10);
  assert.equal(memDb.customers[0].totalBilled, 0);
  assert.equal(memDb.customers[0].balance, 0);

  // Non-string paymentMode rejected cleanly with 400
  var badPay = await requestJson('POST', '/api/orders', {
    items: [{ id: 1, qty: 1 }],
    paymentMode: 123
  });
  assert.equal(badPay.status, 400);

  // Valid statuses ('completed', 'pending', and omitted default -> 'completed') succeed
  var o1 = await requestJson('POST', '/api/orders', { items: [{ id: 1, qty: 1 }], status: 'completed' });
  var o2 = await requestJson('POST', '/api/orders', { items: [{ id: 1, qty: 1 }], status: 'pending' });
  var o3 = await requestJson('POST', '/api/orders', { items: [{ id: 1, qty: 1 }] });
  assert.equal(o1.status, 201);
  assert.equal(o1.body.status, 'completed');
  assert.equal(o2.status, 201);
  assert.equal(o2.body.status, 'pending');
  assert.equal(o3.status, 201);
  assert.equal(o3.body.status, 'completed');
});

// ---------------------------------------------------------------------------
// 5. Explicit Product gstRate Preservation Across Catalog, Preview, Checkout & Invoice
// Prior characterization: preview dropped p.gstRate and fell back to HSN 5%.
// ---------------------------------------------------------------------------

test('Explicit gstRate preservation: catalog, preview, checkout, and invoice agree for 12%, 0%, and HSN fallback 5%', async function () {
  var catalogRes = await requestJson('GET', '/api/products');
  assert.equal(catalogRes.status, 200);
  var prod1 = catalogRes.body.find(function (p) { return p.id === 1; });
  var prod2 = catalogRes.body.find(function (p) { return p.id === 2; });
  var prod3 = catalogRes.body.find(function (p) { return p.id === 3; });
  assert.equal(prod1.gstPercent, 5);
  assert.equal(prod2.gstPercent, 12);
  assert.equal(prod3.gstPercent, 0);

  // Explicit 12% override on HSN 1006 (5% slab)
  var prev12 = await requestJson('POST', '/api/pricing/preview', { items: [{ id: 2, qty: 1 }] });
  assert.equal(prev12.status, 200);
  assert.equal(prev12.body.totals.tax, 60);
  assert.equal(prev12.body.totals.total, 560);
  assert.equal(prev12.body.totals.lines[0].gstPercent, 12);

  var ord12 = await requestJson('POST', '/api/orders', { items: [{ id: 2, qty: 1 }], paymentMode: 'cash' });
  assert.equal(ord12.status, 201);
  assert.equal(ord12.body.tax, 60);
  assert.equal(ord12.body.total, 560);
  assert.equal(ord12.body.items[0].gstRate, 12);

  var inv12 = invoice.computeInvoiceFigures(ord12.body);
  assert.equal(inv12.tax, 60);
  assert.equal(inv12.total, 560);
  assert.equal(inv12.rows[0].gstPercent, 12);

  // Explicit 0% zero-rated override on HSN 1006 (5% slab)
  var prev0 = await requestJson('POST', '/api/pricing/preview', { items: [{ id: 3, qty: 2 }] });
  assert.equal(prev0.status, 200);
  assert.equal(prev0.body.totals.tax, 0);
  assert.equal(prev0.body.totals.total, 200);
  assert.equal(prev0.body.totals.lines[0].gstPercent, 0);

  var ord0 = await requestJson('POST', '/api/orders', { items: [{ id: 3, qty: 2 }], paymentMode: 'cash' });
  assert.equal(ord0.status, 201);
  assert.equal(ord0.body.tax, 0);
  assert.equal(ord0.body.total, 200);
  assert.equal(ord0.body.items[0].gstRate, 0);

  var inv0 = invoice.computeInvoiceFigures(ord0.body);
  assert.equal(inv0.tax, 0);
  assert.equal(inv0.total, 200);
  assert.equal(inv0.rows[0].gstPercent, 0);

  // Absent gstRate falls back cleanly to HSN 1006 5% without polluting item.gstRate
  var prev5 = await requestJson('POST', '/api/pricing/preview', { items: [{ id: 1, qty: 1 }] });
  assert.equal(prev5.status, 200);
  assert.equal(prev5.body.totals.tax, 32);
  assert.equal(prev5.body.totals.total, 672);

  var ord5 = await requestJson('POST', '/api/orders', { items: [{ id: 1, qty: 1 }], paymentMode: 'cash' });
  assert.equal(ord5.status, 201);
  assert.equal(ord5.body.tax, 32);
  assert.equal(ord5.body.total, 672);
  assert.equal(Object.prototype.hasOwnProperty.call(ord5.body.items[0], 'gstRate'), false);

  var reconRes = await requestJson('GET', '/api/reports/gst-reconciliation');
  assert.equal(reconRes.status, 200);
  assert.equal(reconRes.body.mismatchCount, 0);
});
