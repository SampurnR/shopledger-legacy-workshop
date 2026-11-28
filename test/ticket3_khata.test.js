var test = require('node:test');
var assert = require('node:assert/strict');
var http = require('node:http');
var ledger = require('../lib/ledger');
var store = require('../lib/store');
var app = require('../server');

function createBaseDb() {
  return {
    nextSettlementId: 505,
    customers: [
      {
        id: 1,
        name: 'Meera Joshi',
        phone: '9820111222',
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
        phone: '9820333444',
        openingBalance: 0,
        totalBilled: 963.9,
        totalSettled: 0,
        balance: 963.9
      }
    ],
    settlements: [],
    auditLog: []
  };
}

function withMockedCustomerServer(initialDb, fn) {
  var origRead = store.read;
  var origWrite = store.write;
  var origAppendAudit = store.appendAudit;
  var dbState = JSON.parse(JSON.stringify(initialDb));
  var writeCount = 0;
  var auditCalls = [];

  store.read = function () {
    return JSON.parse(JSON.stringify(dbState));
  };
  store.write = function (nextDb) {
    writeCount += 1;
    dbState = JSON.parse(JSON.stringify(nextDb));
  };
  store.appendAudit = function (db, action, details) {
    auditCalls.push({ action: action, details: details });
    return origAppendAudit(db, action, details);
  };

  var server = http.createServer(app);
  return new Promise(function (resolve, reject) {
    server.listen(0, '127.0.0.1', function () {
      var addr = server.address();
      Promise.resolve()
        .then(function () {
          return fn({
            port: addr.port,
            getDbState: function () { return dbState; },
            getWriteCount: function () { return writeCount; },
            getAuditCalls: function () { return auditCalls; }
          });
        })
        .then(resolve, reject);
    });
  }).finally(function () {
    store.read = origRead;
    store.write = origWrite;
    store.appendAudit = origAppendAudit;
    return new Promise(function (resolve) {
      server.close(resolve);
    });
  });
}

function requestJson(port, method, path, bodyObj) {
  return new Promise(function (resolve, reject) {
    var payload = bodyObj !== undefined ? JSON.stringify(bodyObj) : null;
    var headers = { Connection: 'close' };
    if (payload !== null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    var req = http.request({
      hostname: '127.0.0.1',
      port: port,
      path: path,
      method: method,
      agent: false,
      headers: headers
    }, function (res) {
      var chunks = [];
      res.on('data', function (chunk) { chunks.push(chunk); });
      res.on('end', function () {
        var raw = Buffer.concat(chunks).toString('utf8');
        var parsed = raw ? JSON.parse(raw) : null;
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload !== null) req.write(payload);
    req.end();
  });
}

test('Ticket 3 (#3) Khata Ledger & Settlements - Characterization', function (t) {
  t.test('findCustomer matches string id to numeric id (1 == "1") and returns null when missing', function () {
    var db = createBaseDb();
    var foundNumeric = ledger.findCustomer(db, 1);
    var foundString = ledger.findCustomer(db, '1');
    assert.ok(foundNumeric);
    assert.strictEqual(foundNumeric.name, 'Meera Joshi');
    assert.strictEqual(foundString, foundNumeric);
    assert.strictEqual(ledger.findCustomer(db, 999), null);
    assert.strictEqual(ledger.findCustomer({ customers: null }, 1), null);
  });

  t.test('listCustomers returns expected fields, defaults creditLimit to 5000 when undefined, and computes balance', function () {
    var db = createBaseDb();
    var list = ledger.listCustomers(db);
    assert.strictEqual(list.length, 2);

    assert.deepEqual(list[0], {
      id: 1,
      name: 'Meera Joshi',
      phone: '9820111222',
      type: 'Retail',
      gstin: '',
      creditLimit: 5000,
      openingBalance: 450,
      totalBilled: 1982.01,
      totalSettled: 1200,
      balance: 1232.01
    });

    assert.strictEqual(list[1].type, 'Retail');
    assert.strictEqual(list[1].gstin, '');
    assert.strictEqual(list[1].creditLimit, 5000);
    assert.strictEqual(list[1].balance, 963.9);
  });

  t.test('recordSettlement creates receipt, unshifts into settlements, increments nextSettlementId, and updates balances', function () {
    var db = createBaseDb();
    var first = ledger.recordSettlement(db, 1, 200, 'cash', 'First payment');
    assert.strictEqual(first.ok, true);
    assert.strictEqual(first.settlement.id, 505);
    assert.strictEqual(first.settlement.customerId, 1);
    assert.strictEqual(first.settlement.customerName, 'Meera Joshi');
    assert.strictEqual(first.settlement.amount, 200);
    assert.strictEqual(first.settlement.mode, 'cash');
    assert.strictEqual(first.settlement.note, 'First payment');
    assert.match(first.settlement.date, /^\d{2}\/\d{2}\/\d{4}$/);
    assert.strictEqual(db.nextSettlementId, 506);
    assert.strictEqual(first.customer.totalSettled, 1400);
    assert.strictEqual(first.customer.balance, 1032.01);

    var second = ledger.recordSettlement(db, 1, '300', '', '');
    assert.strictEqual(second.ok, true);
    assert.strictEqual(second.settlement.id, 506);
    assert.strictEqual(second.settlement.mode, 'upi');
    assert.strictEqual(second.settlement.note, 'Khata settlement');
    assert.strictEqual(second.customer.totalSettled, 1700);
    assert.strictEqual(second.customer.balance, 732.01);
    assert.strictEqual(db.settlements.length, 2);
    assert.strictEqual(db.settlements[0].id, 506);
    assert.strictEqual(db.settlements[1].id, 505);
  });

  t.test('GET /api/customers returns { customers, settlements } capped at 25 with mocked store', async function () {
    var db = createBaseDb();
    for (var i = 0; i < 30; i++) {
      db.settlements.push({
        id: 600 - i,
        customerId: 1,
        customerName: 'Meera Joshi',
        date: '05/03/2022',
        amount: 10,
        mode: 'upi',
        note: 'Batch ' + i
      });
    }

    await withMockedCustomerServer(db, async function (ctx) {
      var res = await requestJson(ctx.port, 'GET', '/api/customers');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(Array.isArray(res.body.customers), true);
      assert.strictEqual(res.body.customers.length, 2);
      assert.strictEqual(Array.isArray(res.body.settlements), true);
      assert.strictEqual(res.body.settlements.length, 25);
      assert.strictEqual(res.body.settlements[0].id, 600);
      assert.strictEqual(res.body.settlements[24].id, 576);
      assert.strictEqual(ctx.getWriteCount(), 0);
    });
  });
});

test('Ticket 3 (#3) Khata Numeric Addition & Route Validation - Fixes', function (t) {
  t.test('findCustomer handles id 0 and guards null db, booleans, whitespace, NaN, and arrays', function () {
    var db = {
      customers: [
        { id: 0, name: 'Zero ID Customer' },
        { id: 1, name: 'Meera Joshi' }
      ]
    };

    assert.strictEqual(ledger.findCustomer(null, 1), null);
    assert.strictEqual(ledger.findCustomer(db, null), null);
    assert.strictEqual(ledger.findCustomer(db, undefined), null);
    assert.strictEqual(ledger.findCustomer(db, true), null);
    assert.strictEqual(ledger.findCustomer(db, false), null);
    assert.strictEqual(ledger.findCustomer(db, ''), null);
    assert.strictEqual(ledger.findCustomer(db, '   '), null);
    assert.strictEqual(ledger.findCustomer(db, NaN), null);
    assert.strictEqual(ledger.findCustomer(db, []), null);
    assert.strictEqual(ledger.findCustomer(db, [1]), null);

    assert.strictEqual(ledger.findCustomer(db, 0).name, 'Zero ID Customer');
    assert.strictEqual(ledger.findCustomer(db, '0').name, 'Zero ID Customer');
    assert.strictEqual(ledger.findCustomer(db, '1').name, 'Meera Joshi');
  });

  t.test('recordSettlement adds string and whitespace-padded amounts numerically without concatenation', function () {
    var db = createBaseDb();
    var r1 = ledger.recordSettlement(db, 1, '500', 'upi', 'String amount');
    assert.strictEqual(r1.ok, true);
    assert.strictEqual(typeof r1.customer.totalSettled, 'number');
    assert.strictEqual(r1.customer.totalSettled, 1700);
    assert.strictEqual(r1.customer.balance, 732.01);
    assert.strictEqual(r1.settlement.amount, 500);

    var r2 = ledger.recordSettlement(db, 1, ' 250.25 ', 'neft', 'Trimmed string');
    assert.strictEqual(r2.ok, true);
    assert.strictEqual(r2.customer.totalSettled, 1950.25);
    assert.strictEqual(r2.customer.balance, 481.76);
    assert.strictEqual(r2.settlement.amount, 250.25);
  });

  t.test('consecutive string and float settlements avoid concatenation and binary float drift', function () {
    var db = {
      nextSettlementId: 501,
      customers: [
        {
          id: 1,
          name: 'Drift Check',
          creditLimit: 5000,
          openingBalance: 0,
          totalBilled: 1000,
          totalSettled: 0,
          balance: 1000
        }
      ],
      settlements: []
    };

    var steps = ['100', '200.55', 50.45, '0.1', 0.2];
    for (var i = 0; i < steps.length; i++) {
      var res = ledger.recordSettlement(db, 1, steps[i], 'upi', 'Step ' + i);
      assert.strictEqual(res.ok, true);
    }

    assert.strictEqual(db.customers[0].totalSettled, 351.3);
    assert.strictEqual(db.customers[0].balance, 648.7);
  });

  t.test('string-typed ledger fields on customer record are coerced numerically in listCustomers and recordSettlement', function () {
    var db = {
      customers: [
        {
          id: 10,
          name: 'String Ledger',
          creditLimit: '5000',
          openingBalance: '100.50',
          totalBilled: '400.25',
          totalSettled: '200.00',
          balance: '300.75'
        }
      ]
    };

    var listed = ledger.listCustomers(db);
    assert.strictEqual(listed[0].openingBalance, 100.5);
    assert.strictEqual(listed[0].totalBilled, 400.25);
    assert.strictEqual(listed[0].totalSettled, 200);
    assert.strictEqual(listed[0].balance, 300.75);

    var res = ledger.recordSettlement(db, 10, '50.25', 'cash', 'Partial');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.customer.totalSettled, 250.25);
    assert.strictEqual(res.customer.balance, 250.5);
    assert.strictEqual(db.nextSettlementId, 502);
    assert.strictEqual(res.settlement.id, 501);
    assert.strictEqual(db.settlements.length, 1);
  });

  t.test('recordSettlement rejects invalid non-finite, boolean, non-numeric, empty, and non-positive inputs without mutating state', function () {
    var invalidInputs = [
      undefined,
      null,
      '',
      '   ',
      'abc',
      NaN,
      Infinity,
      -Infinity,
      'Infinity',
      '-Infinity',
      0,
      '0',
      -5,
      '-5',
      true,
      false,
      [500],
      { amount: 500 }
    ];

    for (var i = 0; i < invalidInputs.length; i++) {
      var db = createBaseDb();
      var res = ledger.recordSettlement(db, 1, invalidInputs[i], 'upi', 'Invalid');
      assert.strictEqual(res.ok, false, 'Expected rejection for input index ' + i);
      assert.strictEqual(res.error, 'Settlement amount must be greater than zero');
      assert.strictEqual(db.customers[0].totalSettled, 1200);
      assert.strictEqual(db.customers[0].balance, 1232.01);
      assert.strictEqual(db.settlements.length, 0);
    }
  });

  t.test('POST /api/customers/:id/settle persists numeric string settlement and appends audit log without touching disk', async function () {
    var db = createBaseDb();

    await withMockedCustomerServer(db, async function (ctx) {
      var postRes = await requestJson(ctx.port, 'POST', '/api/customers/1/settle', {
        amount: ' 500 ',
        mode: 'cash',
        note: 'Counter payment'
      });

      assert.strictEqual(postRes.status, 201);
      assert.strictEqual(postRes.body.ok, true);
      assert.strictEqual(postRes.body.settlement.amount, 500);
      assert.strictEqual(postRes.body.customer.totalSettled, 1700);
      assert.strictEqual(postRes.body.customer.balance, 732.01);
      assert.strictEqual(ctx.getWriteCount(), 1);
      assert.strictEqual(ctx.getAuditCalls().length, 1);
      assert.strictEqual(ctx.getAuditCalls()[0].action, 'KHATA_SETTLEMENT');
      assert.strictEqual(ctx.getAuditCalls()[0].details, 'Meera Joshi settled ₹500.00 via CASH');

      var getRes = await requestJson(ctx.port, 'GET', '/api/customers');
      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(getRes.body.customers[0].totalSettled, 1700);
      assert.strictEqual(getRes.body.customers[0].balance, 732.01);
      assert.strictEqual(getRes.body.settlements.length, 1);
      assert.strictEqual(getRes.body.settlements[0].amount, 500);
    });
  });
});
