var http = require('node:http');

function deepClone(val) {
  return JSON.parse(JSON.stringify(val));
}

function ensureStructure(db) {
  if (!db.products) db.products = [];
  if (!db.orders) db.orders = [];
  if (!db.customers) db.customers = [];
  if (!db.settlements) db.settlements = [];
  if (!db.auditLog) db.auditLog = [];
  if (!db.nextOrderId) db.nextOrderId = 1001;
  if (!db.nextSettlementId) db.nextSettlementId = 501;
  return db;
}

var BASELINE_FIXTURE = Object.freeze({
  nextOrderId: 1012,
  nextSettlementId: 505,
  products: [
    {
      id: 1,
      sku: 'GRN-001',
      name: 'Indrayani Basmati Rice 5kg',
      category: 'Staples & Grains',
      unit: 'bag',
      hsn: '1006',
      price: 640,
      stock: 18,
      reserved: 2,
      reorderLevel: 10
    },
    {
      id: 2,
      sku: 'GRN-002',
      name: 'Unpolished Toor Dal 1kg',
      category: 'Staples & Grains',
      unit: 'pkt',
      hsn: '0713',
      price: 165,
      stock: 28,
      reserved: 0,
      reorderLevel: 15
    },
    {
      id: 3,
      sku: 'GRN-003',
      name: 'Kolhapuri Thick Poha 500g',
      category: 'Staples & Grains',
      unit: 'pkt',
      hsn: '1104',
      price: 48,
      stock: 35,
      reserved: 0,
      reorderLevel: 20
    },
    {
      id: 4,
      sku: 'OIL-001',
      name: 'Cold-Pressed Sunflower Oil 1L',
      category: 'Oils & Spices',
      unit: 'btl',
      hsn: '1512',
      price: 190,
      stock: 22,
      reserved: 4,
      reorderLevel: 12
    },
    {
      id: 5,
      sku: 'OIL-002',
      name: 'Cold-Pressed Groundnut Oil 5L',
      category: 'Oils & Spices',
      unit: 'jar',
      hsn: '1508',
      price: 1120,
      stock: 9,
      reserved: 1,
      reorderLevel: 8
    },
    {
      id: 6,
      sku: 'DRY-001',
      name: 'A2 Gir Cow Ghee 500ml',
      category: 'Dairy & Ghee',
      unit: 'jar',
      hsn: '0405',
      price: 450,
      stock: 1,
      reserved: 0,
      reorderLevel: 5
    },
    {
      id: 7,
      sku: 'DRY-002',
      name: 'Pasteurized Table Butter 500g',
      category: 'Dairy & Ghee',
      unit: 'box',
      hsn: '0405',
      price: 260,
      stock: 24,
      reserved: 0,
      reorderLevel: 10
    },
    {
      id: 8,
      sku: 'BEV-001',
      name: 'Assam CTC Masala Chai 250g',
      category: 'Beverages & Packaged',
      unit: 'pkt',
      hsn: '0902',
      price: 140,
      stock: 42,
      reserved: 0,
      reorderLevel: 15
    },
    {
      id: 9,
      sku: 'BEV-002',
      name: 'Filter Coffee Decoction Blend 500g',
      category: 'Beverages & Packaged',
      unit: 'pkt',
      hsn: '0901',
      price: 310,
      stock: 15,
      reserved: 0,
      reorderLevel: 8
    },
    {
      id: 10,
      sku: 'GRN-004',
      name: 'Organic Kolhapuri Jaggery 1kg',
      category: 'Staples & Grains',
      unit: 'block',
      hsn: '1701',
      price: 85,
      stock: 0,
      reserved: 0,
      reorderLevel: 15
    },
    {
      id: 11,
      sku: 'SPC-001',
      name: 'Byadgi Kashmiri Chilli Powder 500g',
      category: 'Oils & Spices',
      unit: 'pkt',
      hsn: '0904',
      price: 220,
      stock: 4,
      reserved: 3,
      reorderLevel: 10
    },
    {
      id: 12,
      sku: 'BEV-003',
      name: 'Kokum Sherbet Concentrate 750ml',
      category: 'Beverages & Packaged',
      unit: 'btl',
      hsn: '2106',
      price: 180,
      stock: 14,
      reserved: 0,
      reorderLevel: 6
    },
    {
      id: 13,
      sku: 'GRN-005',
      name: 'Premium Organic Sona Masoori 10kg',
      category: 'Staples & Grains',
      unit: 'bag',
      hsn: '1006',
      gstRate: 12,
      price: 1000,
      stock: 10,
      reserved: 0,
      reorderLevel: 5
    },
    {
      id: 14,
      sku: 'GRN-006',
      name: 'Unbranded Loose Wheat 5kg',
      category: 'Staples & Grains',
      unit: 'bag',
      hsn: '1006',
      gstRate: 0,
      price: 250,
      stock: 20,
      reserved: 2,
      reorderLevel: 5
    },
    {
      id: 15,
      sku: 'SPC-002',
      name: 'Alleppey Turmeric Powder 250g',
      category: 'Oils & Spices',
      unit: 'pkt',
      hsn: '0910',
      price: 100,
      stock: 12,
      reserved: 0,
      reorderLevel: 5
    },
    {
      id: 16,
      sku: 'DRY-003',
      name: 'Reserved-Exceeded Sample Pack',
      category: 'Dairy & Ghee',
      unit: 'box',
      hsn: '0405',
      gstRate: 0.12,
      price: 200,
      stock: 3,
      reserved: 5,
      reorderLevel: 5
    }
  ],
  customers: [
    {
      id: 1,
      name: 'Meera Joshi',
      phone: '98230 11420',
      type: 'Retail',
      gstin: '',
      creditLimit: 5000,
      openingBalance: 450,
      totalBilled: 1982.01,
      totalSettled: 1200,
      balance: 1232.01
    },
    {
      id: 2,
      name: 'Anil Kulkarni',
      phone: '98901 44210',
      type: 'Retail',
      gstin: '',
      creditLimit: 4000,
      openingBalance: 320,
      totalBilled: 0,
      totalSettled: 200,
      balance: 120
    },
    {
      id: 3,
      name: 'Priya Nair',
      phone: '97654 88312',
      type: 'Retail',
      gstin: '',
      creditLimit: 5000,
      openingBalance: 0,
      totalBilled: 0,
      totalSettled: 0,
      balance: 0
    },
    {
      id: 4,
      name: 'Suresh Deshmukh',
      phone: '94220 77819',
      type: 'Wholesale',
      gstin: '27AAJFD4412N1Z2',
      creditLimit: 15000,
      openingBalance: 1200,
      totalBilled: 1407,
      totalSettled: 1000,
      balance: 1607
    },
    {
      id: 5,
      name: 'Kalyani Foods (Wholesale)',
      phone: '020 2445 9921',
      type: 'Wholesale',
      gstin: '27AABCK8821M1Z9',
      creditLimit: 25000,
      openingBalance: 2500,
      totalBilled: 2194.5,
      totalSettled: 2500,
      balance: 2194.5
    },
    {
      id: 6,
      name: 'Ramesh Patil (Cash Only)',
      phone: '98221 10006',
      type: 'Retail',
      gstin: '',
      creditLimit: 0,
      openingBalance: 0,
      totalBilled: 0,
      totalSettled: 0,
      balance: 0
    },
    {
      id: 7,
      name: 'Vikram Traders',
      phone: '94230 20007',
      type: 'Wholesale',
      gstin: '27AAACV7712K1Z4',
      creditLimit: 10000,
      openingBalance: 500,
      totalBilled: 9000,
      totalSettled: 500,
      balance: 9000
    },
    {
      id: 8,
      name: 'Asha Kirana (Advance Credit)',
      phone: '97640 30008',
      type: 'Retail',
      gstin: '',
      creditLimit: 0,
      openingBalance: 0,
      totalBilled: 0,
      totalSettled: 50.39,
      balance: -50.39
    },
    {
      id: 9,
      name: 'Neha Provision Store',
      phone: '98500 40009',
      type: 'Retail',
      gstin: '',
      openingBalance: 0,
      totalBilled: 0,
      totalSettled: 0,
      balance: 0
    }
  ],
  orders: [
    {
      id: 1001,
      date: '28/12/2021',
      customer: 'Meera Joshi',
      customerId: 1,
      paymentMode: 'khata',
      status: 'completed',
      items: [
        { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 2 },
        { id: 2, sku: 'GRN-002', name: 'Unpolished Toor Dal 1kg', hsn: '0713', price: 165, qty: 2 }
      ],
      coupon: '',
      subtotal: 610,
      discount: 0,
      tax: 66.9,
      total: 676.9
    },
    {
      id: 1002,
      date: '05/01/2022',
      customer: 'Anil Kulkarni',
      customerId: 2,
      paymentMode: 'upi',
      status: 'completed',
      items: [
        { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
        { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
      ],
      coupon: 'SAVE10',
      subtotal: 1020,
      discount: 102,
      tax: 45.9,
      total: 963.9
    },
    {
      id: 1003,
      date: '14/01/2022',
      customer: 'Walk-in',
      customerId: null,
      paymentMode: 'cash',
      status: 'completed',
      items: [
        { id: 7, sku: 'DRY-002', name: 'Pasteurized Table Butter 500g', hsn: '0405', price: 260, qty: 1 },
        { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 1 }
      ],
      coupon: 'FLAT50',
      subtotal: 400,
      discount: 50,
      tax: 49.35,
      total: 399.35
    },
    {
      id: 1004,
      date: '30/01/2022',
      customer: 'Kalyani Foods (Wholesale)',
      customerId: 5,
      paymentMode: 'khata',
      status: 'completed',
      items: [
        { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
      ],
      coupon: 'SAVE10',
      subtotal: 2240,
      discount: 150,
      tax: 104.5,
      total: 2194.5
    },
    {
      id: 1005,
      date: '02/02/2022',
      customer: 'Priya Nair',
      customerId: 3,
      paymentMode: 'upi',
      status: 'completed',
      items: [
        { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
        { id: 12, sku: 'BEV-003', name: 'Kokum Sherbet Concentrate 750ml', hsn: '2106', price: 180, qty: 2 }
      ],
      coupon: 'FLAT50',
      subtotal: 1000,
      discount: 50,
      tax: 91.96,
      total: 1041.96
    },
    {
      id: 1006,
      date: '18/02/2022',
      customer: 'Meera Joshi',
      customerId: 1,
      paymentMode: 'khata',
      status: 'completed',
      items: [
        { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', hsn: '0405', price: 450, qty: 2 },
        { id: 9, sku: 'BEV-002', name: 'Filter Coffee Decoction Blend 500g', hsn: '0901', price: 310, qty: 1 }
      ],
      coupon: 'WELCOME',
      subtotal: 1210,
      discount: 60.5,
      tax: 155.61,
      total: 1305.11
    },
    {
      id: 1007,
      date: '04/03/2022',
      customer: 'Suresh Deshmukh',
      customerId: 4,
      paymentMode: 'khata',
      status: 'pending',
      items: [
        { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', hsn: '0405', price: 450, qty: 2 },
        { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
      ],
      coupon: '',
      subtotal: 1280,
      discount: 0,
      tax: 127,
      total: 1407
    },
    {
      id: 1008,
      date: '15/03/2022',
      customer: 'Walk-in',
      customerId: null,
      paymentMode: 'cash',
      status: 'completed',
      items: [
        { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 1 },
        { id: 12, sku: 'BEV-003', name: 'Kokum Sherbet Concentrate 750ml', hsn: '2106', price: 180, qty: 2 }
      ],
      coupon: '',
      subtotal: 500,
      discount: 0,
      tax: 90,
      total: 590
    },
    {
      id: 1009,
      date: '02/01/2023',
      customer: 'Walk-in',
      customerId: null,
      paymentMode: 'upi',
      status: 'completed',
      items: [
        { id: 15, sku: 'SPC-002', name: 'Alleppey Turmeric Powder 250g', hsn: '0910', price: 100, qty: 1 }
      ],
      coupon: '',
      subtotal: 100,
      discount: 0,
      tax: 18,
      total: 118
    },
    {
      id: 1010,
      date: '25/02/2023',
      customer: 'Priya Nair',
      customerId: 3,
      paymentMode: 'cash',
      status: 'cancelled',
      cancelledAt: '26/02/2023',
      cancelReason: 'Customer changed mind',
      items: [
        { id: 2, sku: 'GRN-002', name: 'Unpolished Toor Dal 1kg', hsn: '0713', price: 165, qty: 1 }
      ],
      coupon: '',
      subtotal: 165,
      discount: 0,
      tax: 8.25,
      total: 173.25
    },
    {
      id: 1011,
      date: '25/02/2023',
      customer: 'Anil Kulkarni',
      customerId: 2,
      paymentMode: 'upi',
      status: 'completed',
      items: [
        { id: 13, sku: 'GRN-005', name: 'Premium Organic Sona Masoori 10kg', hsn: '1006', gstRate: 12, price: 1000, qty: 1 }
      ],
      coupon: '',
      subtotal: 1000,
      discount: 0,
      tax: 120,
      total: 1120
    }
  ],
  settlements: [
    {
      id: 501,
      customerId: 1,
      customerName: 'Meera Joshi',
      date: '10/01/2022',
      amount: 700,
      mode: 'upi',
      note: 'GPay settlement for Dec dues'
    },
    {
      id: 502,
      customerId: 5,
      customerName: 'Kalyani Foods (Wholesale)',
      date: '05/02/2022',
      amount: 2500,
      mode: 'neft',
      note: 'NEFT Ref #HDFC22020591'
    },
    {
      id: 503,
      customerId: 1,
      customerName: 'Meera Joshi',
      date: '22/02/2022',
      amount: 500,
      mode: 'cash',
      note: 'Part payment at counter'
    },
    {
      id: 504,
      customerId: 4,
      customerName: 'Suresh Deshmukh',
      date: '01/03/2022',
      amount: 1000,
      mode: 'upi',
      note: 'Opening balance part settlement'
    }
  ],
  auditLog: [
    {
      ts: '2023-02-25T12:15:00.000Z',
      action: 'ORDER_CREATED',
      details: 'Order #1011 (Anil Kulkarni) ₹1120.00'
    },
    {
      ts: '2023-02-25T11:00:00.000Z',
      action: 'ORDER_CANCELLED',
      details: 'Order #1010 cancelled'
    },
    {
      ts: '2023-01-02T10:30:00.000Z',
      action: 'ORDER_CREATED',
      details: 'Order #1009 (Walk-in) ₹118.00'
    },
    {
      ts: '2022-03-15T14:22:10.000Z',
      action: 'ORDER_CREATED',
      details: 'Order #1008 (Walk-in) ₹590.00'
    }
  ]
});

var currentDb = ensureStructure(deepClone(BASELINE_FIXTURE));

var storePath = require.resolve('../../lib/store');
var storeStub = {
  read: function () {
    return ensureStructure(deepClone(currentDb));
  },
  write: function (db) {
    currentDb = ensureStructure(deepClone(db));
  },
  appendAudit: function (db, action, details) {
    if (!db.auditLog) db.auditLog = [];
    db.auditLog.unshift({
      ts: new Date().toISOString(),
      action: action,
      details: details || ''
    });
    if (db.auditLog.length > 100) {
      db.auditLog = db.auditLog.slice(0, 100);
    }
  }
};

require.cache[storePath] = {
  id: storePath,
  filename: storePath,
  loaded: true,
  exports: storeStub
};

var app = require('../../server');

var server = null;
var port = 0;
var baseUrl = '';
var keySeq = 0;

function startServer() {
  if (server) {
    return Promise.resolve({ port: port, baseUrl: baseUrl });
  }
  return new Promise(function (resolve, reject) {
    var srv = app.listen(0, '127.0.0.1', function () {
      server = srv;
      port = srv.address().port;
      baseUrl = 'http://127.0.0.1:' + port;
      resolve({ port: port, baseUrl: baseUrl });
    });
    srv.on('error', reject);
  });
}

function stopServer() {
  if (!server) return Promise.resolve();
  var srv = server;
  server = null;
  port = 0;
  baseUrl = '';
  return new Promise(function (resolve) {
    if (typeof srv.closeAllConnections === 'function') {
      srv.closeAllConnections();
    }
    srv.close(function () {
      resolve();
    });
  });
}

function resetFixture(overrides) {
  var next = deepClone(BASELINE_FIXTURE);
  if (overrides && typeof overrides === 'object') {
    if (overrides.products) next.products = deepClone(overrides.products);
    if (overrides.customers) next.customers = deepClone(overrides.customers);
    if (overrides.orders) next.orders = deepClone(overrides.orders);
    if (overrides.settlements) next.settlements = deepClone(overrides.settlements);
    if (overrides.auditLog) next.auditLog = deepClone(overrides.auditLog);
    if (overrides.nextOrderId != null) next.nextOrderId = overrides.nextOrderId;
    if (overrides.nextSettlementId != null) next.nextSettlementId = overrides.nextSettlementId;
  }
  currentDb = ensureStructure(next);
  return deepClone(currentDb);
}

function getDb() {
  return deepClone(currentDb);
}

function nextIdempotencyKey(prefix) {
  keySeq += 1;
  return (prefix || 'e2e-key') + '-' + Date.now() + '-' + keySeq;
}

function request(method, reqPath, body, headers) {
  return new Promise(function (resolve, reject) {
    if (!server) {
      return reject(new Error('E2E server is not started; call startServer() first'));
    }

    var reqHeaders = Object.assign({ Connection: 'close' }, headers || {});
    var payload = null;

    if (body !== undefined && body !== null) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
      if (!reqHeaders['Content-Length'] && !reqHeaders['content-length']) {
        reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      }
    }

    var opts = {
      hostname: '127.0.0.1',
      port: port,
      path: reqPath,
      method: method,
      headers: reqHeaders,
      agent: false
    };

    var req = http.request(opts, function (res) {
      var chunks = [];
      res.on('data', function (chunk) {
        chunks.push(chunk);
      });
      res.on('end', function () {
        var text = Buffer.concat(chunks).toString('utf8');
        var ct = String(res.headers['content-type'] || '').toLowerCase();
        var parsed = text;
        if (ct.indexOf('application/json') !== -1 && text) {
          try {
            parsed = JSON.parse(text);
          } catch (e) {
            parsed = text;
          }
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
          text: text
        });
      });
    });

    req.on('error', reject);
    if (payload !== null) {
      req.write(payload);
    }
    req.end();
  });
}

module.exports = {
  BASELINE_FIXTURE: BASELINE_FIXTURE,
  startServer: startServer,
  stopServer: stopServer,
  resetFixture: resetFixture,
  resetDb: resetFixture,
  getDb: getDb,
  nextIdempotencyKey: nextIdempotencyKey,
  request: request
};
