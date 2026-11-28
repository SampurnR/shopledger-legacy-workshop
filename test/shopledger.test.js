var test = require('node:test');
var assert = require('node:assert/strict');
var http = require('node:http');

var app = require('../server');
var store = require('../lib/store');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');
var dates = require('../lib/dates');
var invoice = require('../lib/invoice');

// In-memory seed fixture (never reads or writes data/db.json)
var SEED_DB = {
  nextOrderId: 1009,
  nextSettlementId: 505,
  products: [
    { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', category: 'Staples & Grains', unit: 'bag', hsn: '1006', price: 640, stock: 18, reserved: 2, reorderLevel: 10 },
    { id: 2, sku: 'GRN-002', name: 'Unpolished Toor Dal 1kg', category: 'Staples & Grains', unit: 'pkt', hsn: '0713', price: 165, stock: 28, reserved: 0, reorderLevel: 15 },
    { id: 3, sku: 'GRN-003', name: 'Kolhapuri Thick Poha 500g', category: 'Staples & Grains', unit: 'pkt', hsn: '1104', price: 48, stock: 35, reserved: 0, reorderLevel: 20 },
    { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', category: 'Oils & Spices', unit: 'btl', hsn: '1512', price: 190, stock: 22, reserved: 4, reorderLevel: 12 },
    { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', category: 'Oils & Spices', unit: 'jar', hsn: '1508', price: 1120, stock: 9, reserved: 1, reorderLevel: 8 },
    { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', category: 'Dairy & Ghee', unit: 'jar', hsn: '0405', price: 450, stock: 1, reserved: 0, reorderLevel: 5 },
    { id: 7, sku: 'DRY-002', name: 'Pasteurized Table Butter 500g', category: 'Dairy & Ghee', unit: 'box', hsn: '0405', price: 260, stock: 24, reserved: 0, reorderLevel: 10 },
    { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', category: 'Beverages & Packaged', unit: 'pkt', hsn: '0902', price: 140, stock: 42, reserved: 0, reorderLevel: 15 },
    { id: 9, sku: 'BEV-002', name: 'Filter Coffee Decoction Blend 500g', category: 'Beverages & Packaged', unit: 'pkt', hsn: '0901', price: 310, stock: 15, reserved: 0, reorderLevel: 8 },
    { id: 10, sku: 'GRN-004', name: 'Organic Kolhapuri Jaggery 1kg', category: 'Staples & Grains', unit: 'block', hsn: '1701', price: 85, stock: 0, reserved: 0, reorderLevel: 15 },
    { id: 11, sku: 'SPC-001', name: 'Byadgi Kashmiri Chilli Powder 500g', category: 'Oils & Spices', unit: 'pkt', hsn: '0904', price: 220, stock: 4, reserved: 3, reorderLevel: 10 },
    { id: 12, sku: 'BEV-003', name: 'Kokum Sherbet Concentrate 750ml', category: 'Beverages & Packaged', unit: 'btl', hsn: '2106', price: 180, stock: 14, reserved: 0, reorderLevel: 6 }
  ],
  customers: [
    { id: 1, name: 'Meera Joshi', phone: '98230 11420', type: 'Retail', gstin: '', creditLimit: 5000, openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200, balance: 1232.01 },
    { id: 2, name: 'Anil Kulkarni', phone: '98901 44210', type: 'Retail', gstin: '', creditLimit: 4000, openingBalance: 320, totalBilled: 0, totalSettled: 200, balance: 120 },
    { id: 3, name: 'Priya Nair', phone: '97654 88312', type: 'Retail', gstin: '', creditLimit: 5000, openingBalance: 0, totalBilled: 0, totalSettled: 0, balance: 0 },
    { id: 4, name: 'Suresh Deshmukh', phone: '94220 77819', type: 'Wholesale', gstin: '27AAJFD4412N1Z2', creditLimit: 15000, openingBalance: 1200, totalBilled: 1407, totalSettled: 1000, balance: 1607 },
    { id: 5, name: 'Kalyani Foods (Wholesale)', phone: '020 2445 9921', type: 'Wholesale', gstin: '27AABCK8821M1Z9', creditLimit: 25000, openingBalance: 2500, totalBilled: 2194.5, totalSettled: 2500, balance: 2194.5 }
  ],
  orders: [
    {
      id: 1001, date: '28/12/2021', customer: 'Meera Joshi', customerId: 1, paymentMode: 'khata', status: 'completed',
      items: [
        { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 2 },
        { id: 2, sku: 'GRN-002', name: 'Unpolished Toor Dal 1kg', hsn: '0713', price: 165, qty: 2 }
      ],
      coupon: '', subtotal: 610, discount: 0, tax: 66.9, total: 676.9
    },
    {
      id: 1002, date: '05/01/2022', customer: 'Anil Kulkarni', customerId: 2, paymentMode: 'upi', status: 'completed',
      items: [
        { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
        { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
      ],
      coupon: 'SAVE10', subtotal: 1020, discount: 102, tax: 45.9, total: 963.9
    },
    {
      id: 1003, date: '14/01/2022', customer: 'Walk-in', customerId: null, paymentMode: 'cash', status: 'completed',
      items: [
        { id: 7, sku: 'DRY-002', name: 'Pasteurized Table Butter 500g', hsn: '0405', price: 260, qty: 1 },
        { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 1 }
      ],
      coupon: 'FLAT50', subtotal: 400, discount: 50, tax: 49.35, total: 399.35
    },
    {
      id: 1004, date: '30/01/2022', customer: 'Kalyani Foods (Wholesale)', customerId: 5, paymentMode: 'khata', status: 'completed',
      items: [
        { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
      ],
      coupon: 'SAVE10', subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5
    },
    {
      id: 1005, date: '02/02/2022', customer: 'Priya Nair', customerId: 3, paymentMode: 'upi', status: 'completed',
      items: [
        { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
        { id: 12, sku: 'BEV-003', name: 'Kokum Sherbet Concentrate 750ml', hsn: '2106', price: 180, qty: 2 }
      ],
      coupon: 'FLAT50', subtotal: 1000, discount: 50, tax: 91.96, total: 1041.96
    },
    {
      id: 1006, date: '18/02/2022', customer: 'Meera Joshi', customerId: 1, paymentMode: 'khata', status: 'completed',
      items: [
        { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', hsn: '0405', price: 450, qty: 2 },
        { id: 9, sku: 'BEV-002', name: 'Filter Coffee Decoction Blend 500g', hsn: '0901', price: 310, qty: 1 }
      ],
      coupon: 'WELCOME', subtotal: 1210, discount: 60.5, tax: 155.61, total: 1305.11
    },
    {
      id: 1007, date: '04/03/2022', customer: 'Suresh Deshmukh', customerId: 4, paymentMode: 'khata', status: 'pending',
      items: [
        { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', hsn: '0405', price: 450, qty: 2 },
        { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
      ],
      coupon: '', subtotal: 1280, discount: 0, tax: 127, total: 1407
    },
    {
      id: 1008, date: '15/03/2022', customer: 'Walk-in', customerId: null, paymentMode: 'cash', status: 'completed',
      items: [
        { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 1 },
        { id: 12, sku: 'BEV-003', name: 'Kokum Sherbet Concentrate 750ml', hsn: '2106', price: 180, qty: 2 }
      ],
      coupon: '', subtotal: 500, discount: 0, tax: 90, total: 590
    }
  ],
  settlements: [
    { id: 501, customerId: 1, customerName: 'Meera Joshi', date: '10/01/2022', amount: 700, mode: 'upi', note: 'GPay settlement for Dec dues' },
    { id: 502, customerId: 5, customerName: 'Kalyani Foods (Wholesale)', date: '05/02/2022', amount: 2500, mode: 'neft', note: 'NEFT Ref #HDFC22020591' },
    { id: 503, customerId: 1, customerName: 'Meera Joshi', date: '22/02/2022', amount: 500, mode: 'cash', note: 'Part payment at counter' },
    { id: 504, customerId: 4, customerName: 'Suresh Deshmukh', date: '01/03/2022', amount: 1000, mode: 'upi', note: 'Opening balance part settlement' }
  ],
  auditLog: [
    { ts: '2022-03-15T14:22:10.000Z', action: 'ORDER_CREATED', details: 'Order #1008 (Walk-in) ₹590.00' }
  ]
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

var memDb;
var origRead = store.read;
var origWrite = store.write;
var server;
var baseUrl;

function request(method, reqPath, body) {
  return new Promise(function (resolve, reject) {
    var payload = body != null
      ? (typeof body === 'string' ? body : JSON.stringify(body))
      : null;
    var headers = {};
    if (payload != null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    var req = http.request(baseUrl + reqPath, { method: method, headers: headers }, function (res) {
      var chunks = [];
      res.on('data', function (d) { chunks.push(d); });
      res.on('end', function () {
        var text = Buffer.concat(chunks).toString('utf8');
        var json = null;
        try {
          json = JSON.parse(text);
        } catch (e) {
          json = null;
        }
        resolve({ status: res.statusCode, text: text, json: json });
      });
    });

    req.on('error', reject);
    if (payload != null) req.write(payload);
    req.end();
  });
}

test.before(function (_, done) {
  memDb = clone(SEED_DB);
  store.read = function () { return clone(memDb); };
  store.write = function (nextDb) { memDb = clone(nextDb); };

  server = app.listen(0, function () {
    var addr = server.address();
    baseUrl = 'http://127.0.0.1:' + addr.port;
    done();
  });
});

test.beforeEach(function () {
  memDb = clone(SEED_DB);
});

test.after(function (_, done) {
  store.read = origRead;
  store.write = origWrite;
  server.close(done);
});

// Ticket 1: Invoice & GST reconciliation
test('Ticket 1: GST reconciliation has zero mismatches across seeded orders', async function () {
  var res = await request('GET', '/api/reports/gst-reconciliation');
  assert.equal(res.status, 200);
  assert.equal(res.json.totalChecked, 8);
  assert.equal(res.json.mismatchCount, 0);
  assert.equal(res.json.totalDelta, 0);

  var inv1002 = await request('GET', '/orders/1002/invoice');
  assert.equal(inv1002.status, 200);
  assert.ok(inv1002.text.indexOf('INV-1002') !== -1);
  assert.ok(inv1002.text.indexOf('₹963.90') !== -1);
  assert.equal(inv1002.text.indexOf('Accountant Reconciliation Notice'), -1);

  var inv1004 = await request('GET', '/orders/1004/invoice');
  assert.equal(inv1004.status, 200);
  assert.ok(inv1004.text.indexOf('-₹150.00') !== -1);
  assert.ok(inv1004.text.indexOf('₹2194.50') !== -1);
});

test('Pricing apportions coupon discount without penny drift and supports HSN prefixes', function () {
  var totals = pricing.computeTotals([
    { id: 1, name: 'A', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'B', hsn: '1006', price: 100, qty: 1 },
    { id: 3, name: 'C', hsn: '10069010', price: 100, qty: 1 },
    { id: 4, name: 'Free', hsn: '1006', price: 0, qty: 1 }
  ], 'FLAT50');

  assert.equal(totals.subtotal, 300);
  assert.equal(totals.discount, 50);
  assert.equal(totals.taxable, 250);
  var sumLineDiscounts = totals.lines.reduce(function (s, l) { return s + l.discount; }, 0);
  var sumLineTaxable = totals.lines.reduce(function (s, l) { return s + l.taxable; }, 0);
  assert.equal(Math.round(sumLineDiscounts * 100) / 100, 50);
  assert.equal(Math.round(sumLineTaxable * 100) / 100, 250);
  assert.equal(tax.getRateForItem({ hsn: '10069010' }), 0.05);
});

test('Invoice renderer escapes HTML special characters in customer and order fields', function () {
  var html = invoice.render({
    id: 9999,
    date: '01/03/2022',
    customer: '<script>alert("xss")</script>',
    paymentMode: 'cash',
    status: 'completed',
    coupon: '',
    total: 147,
    items: [{ id: 8, sku: 'BEV-001', name: 'Tea', hsn: '0902', price: 140, qty: 1 }]
  });
  assert.equal(html.indexOf('<script>'), -1);
  assert.ok(html.indexOf('&lt;script&gt;') !== -1);
});

// Ticket 2: Sell last unit & restore stock on cancel
test('Ticket 2: Allows selling exact last sellable unit and rejects overselling or duplicate lines', async function () {
  var dupRes = await request('POST', '/api/orders', {
    items: [{ id: 6, qty: 1 }, { id: 6, qty: 1 }],
    paymentMode: 'cash'
  });
  assert.equal(dupRes.status, 409);

  var okRes = await request('POST', '/api/orders', {
    items: [{ id: 6, qty: 1 }],
    paymentMode: 'cash'
  });
  assert.equal(okRes.status, 201);
  assert.equal(okRes.json.items[0].gstRate, 12);

  var dbAfter = store.read();
  var ghee = dbAfter.products.find(function (p) { return p.id === 6; });
  assert.equal(ghee.stock, 0);

  var outRes = await request('POST', '/api/orders', {
    items: [{ id: 6, qty: 1 }],
    paymentMode: 'cash'
  });
  assert.equal(outRes.status, 409);
});

test('Ticket 2: Cancelling an order restores physical stock and reverses Khata debit', async function () {
  var beforeDb = store.read();
  var meeraBefore = beforeDb.customers.find(function (c) { return c.id === 1; });
  var riceBefore = beforeDb.products.find(function (p) { return p.id === 1; });

  var createRes = await request('POST', '/api/orders', {
    items: [{ id: 1, qty: 2 }],
    customerId: 1,
    paymentMode: 'khata'
  });
  assert.equal(createRes.status, 201);

  var cancelRes = await request('POST', '/api/orders/' + createRes.json.id + '/cancel', {
    reason: 'Unit test cancel'
  });
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.json.status, 'cancelled');

  var afterDb = store.read();
  var meeraAfter = afterDb.customers.find(function (c) { return c.id === 1; });
  var riceAfter = afterDb.products.find(function (p) { return p.id === 1; });
  assert.equal(riceAfter.stock, riceBefore.stock);
  assert.equal(riceAfter.reserved, riceBefore.reserved);
  assert.equal(meeraAfter.totalBilled, meeraBefore.totalBilled);
  assert.equal(meeraAfter.balance, meeraBefore.balance);

  var secondCancel = await request('POST', '/api/orders/' + createRes.json.id + '/cancel', {});
  assert.equal(secondCancel.status, 400);
});

// Ticket 3: Order history sorting/date range & Khata numeric settlements
test('Ticket 3: Order history sorts chronologically newest-first across years and filters date ranges', async function () {
  var allRes = await request('GET', '/api/orders');
  assert.equal(allRes.status, 200);
  var ids = allRes.json.map(function (o) { return o.id; });
  assert.deepEqual(ids, [1008, 1007, 1006, 1005, 1004, 1003, 1002, 1001]);

  var rangeRes = await request('GET', '/api/orders?from=2022-01-01&to=2022-02-15');
  assert.equal(rangeRes.status, 200);
  assert.deepEqual(rangeRes.json.map(function (o) { return o.id; }), [1005, 1004, 1003, 1002]);

  var hashSearch = await request('GET', '/api/orders?search=%231004');
  assert.equal(hashSearch.status, 200);
  assert.deepEqual(hashSearch.json.map(function (o) { return o.id; }), [1004]);

  assert.equal(dates.getFiscalYear('15/03/2022'), 'FY21-22');
  assert.equal(dates.getFiscalYear('01/04/2022'), 'FY22-23');
});

test('Ticket 3: Khata settlement performs numeric addition even with string input', async function () {
  var res = await request('POST', '/api/customers/1/settle', {
    amount: '500',
    mode: 'upi',
    note: 'Part due'
  });
  assert.equal(res.status, 201);
  assert.equal(typeof res.json.customer.totalSettled, 'number');
  assert.equal(res.json.customer.totalSettled, 1700);
  assert.equal(res.json.customer.balance, 732.01);

  assert.equal((await request('POST', '/api/customers/1/settle', { amount: 'abc', mode: 'upi' })).status, 400);
  assert.equal((await request('POST', '/api/customers/1/settle', { amount: 100, mode: 'crypto' })).status, 400);
});

test('API validates order payloads, coupons, khata credit limits, and malformed JSON', async function () {
  assert.equal((await request('POST', '/api/orders', { items: 'bad' })).status, 400);
  assert.equal((await request('POST', '/api/orders', { items: [{ id: 1, qty: 0 }] })).status, 400);
  assert.equal((await request('POST', '/api/orders', { items: [{ id: 1, qty: -2 }] })).status, 400);
  assert.equal((await request('POST', '/api/orders', { items: [{ id: 1, qty: 1 }], customerId: 999 })).status, 400);
  assert.equal((await request('POST', '/api/orders', { items: [{ id: 1, qty: 1 }], paymentMode: 'bitcoin' })).status, 400);
  assert.equal((await request('POST', '/api/orders', { items: [{ id: 1, qty: 1 }], status: 'cancelled' })).status, 400);
  assert.equal((await request('POST', '/api/orders', { items: [{ id: 1, qty: 1 }], paymentMode: 'khata' })).status, 400);
  assert.equal((await request('POST', '/api/orders', { items: [{ id: 1, qty: 1 }], coupon: 'DIWALI20' })).status, 400);

  var limitRes = await request('POST', '/api/orders', {
    items: [{ id: 5, qty: 5 }],
    customerId: 2,
    paymentMode: 'khata'
  });
  assert.equal(limitRes.status, 409);

  var badJson = await request('POST', '/api/orders', '{broken');
  assert.equal(badJson.status, 400);
  assert.equal(badJson.json.error, 'Invalid JSON payload');
});

test('Dashboard, products, coupons, preview, export, and static UI routes work cleanly', async function () {
  var homeRes = await request('GET', '/');
  assert.equal(homeRes.status, 200);
  assert.ok(homeRes.text.indexOf('ShopLedger') !== -1);

  var prodRes = await request('GET', '/api/products');
  assert.equal(prodRes.status, 200);
  assert.equal(prodRes.json.length, 12);

  var couponRes = await request('GET', '/api/coupons');
  assert.equal(couponRes.status, 200);
  assert.equal(couponRes.json.length, 4);

  var dashRes = await request('GET', '/api/reports/dashboard');
  assert.equal(dashRes.status, 200);
  assert.equal(dashRes.json.summary.reconciliationMismatchCount, 0);

  var prevRes = await request('POST', '/api/pricing/preview', {
    items: [{ id: 1, qty: 1 }],
    coupon: 'save10'
  });
  assert.equal(prevRes.status, 200);
  assert.equal(prevRes.json.couponStatus.valid, true);
  assert.equal(prevRes.json.totals.discount, 64);

  assert.equal((await request('GET', '/api/admin/export')).status, 403);
  assert.equal((await request('GET', '/api/admin/export?key=shopledger-admin-2021')).status, 200);
});
