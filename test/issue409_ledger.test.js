var test = require('node:test');
var assert = require('node:assert/strict');
var http = require('node:http');
var ledger = require('../lib/ledger');
var store = require('../lib/store');
var app = require('../server');

function createIssue409Db() {
  return {
    nextSettlementId: 501,
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
        name: 'Zero Limit Customer',
        phone: '9820555666',
        type: 'Retail',
        gstin: '',
        creditLimit: 0,
        openingBalance: 0,
        totalBilled: 0,
        totalSettled: 0,
        balance: 0
      },
      {
        id: 3,
        name: 'Default Limit Customer',
        phone: '9820777888',
        type: 'Retail',
        gstin: '',
        openingBalance: 100,
        totalBilled: 200,
        totalSettled: 50,
        balance: 250
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

test('Issue #409 Ledger Credit Limit & Settlement Precision - Characterization', function (t) {
  t.test('listCustomers preserves creditLimit 0 and defaults undefined to 5000', function () {
    var db = createIssue409Db();
    var list = ledger.listCustomers(db);
    assert.strictEqual(list[0].creditLimit, 5000);
    assert.strictEqual(list[1].creditLimit, 0);
    assert.strictEqual(list[2].creditLimit, 5000);
  });

  t.test('chargeOrderToKhata succeeds within limit and rejects exceeding creditLimit 0', function () {
    var db = createIssue409Db();
    var okRes = ledger.chargeOrderToKhata(db, 1, 500);
    assert.strictEqual(okRes.ok, true);
    assert.strictEqual(okRes.customer.totalBilled, 2482.01);
    assert.strictEqual(okRes.customer.balance, 1732.01);

    var zeroRes = ledger.chargeOrderToKhata(db, 2, 100);
    assert.strictEqual(zeroRes.ok, false);
    assert.match(zeroRes.error, /Khata credit limit exceeded/);
    assert.strictEqual(db.customers[1].totalBilled, 0);
  });

  t.test('reverseOrderDebit reduces totalBilled, floors at 0, and updates balance', function () {
    var db = createIssue409Db();
    ledger.reverseOrderDebit(db, 3, 150);
    assert.strictEqual(db.customers[2].totalBilled, 50);
    assert.strictEqual(db.customers[2].balance, 100);

    ledger.reverseOrderDebit(db, 3, 500);
    assert.strictEqual(db.customers[2].totalBilled, 0);
    assert.strictEqual(db.customers[2].balance, 50);

    ledger.reverseOrderDebit(db, 999, 100);
    assert.strictEqual(db.customers[2].totalBilled, 0);
  });

  t.test('recordSettlement rejects sub-paisa 0.004 and rounds 0.005 / 10.126 consistently', function () {
    var db = createIssue409Db();
    var subPaisa = ledger.recordSettlement(db, 1, 0.004, 'upi', 'Too small');
    assert.strictEqual(subPaisa.ok, false);
    assert.strictEqual(subPaisa.error, 'Settlement amount must be greater than zero');

    var halfPaisa = ledger.recordSettlement(db, 1, 0.005, 'upi', 'Half paisa');
    assert.strictEqual(halfPaisa.ok, true);
    assert.strictEqual(halfPaisa.settlement.amount, 0.01);
    assert.strictEqual(halfPaisa.customer.totalSettled, 1200.01);

    var rounded = ledger.recordSettlement(db, 1, 10.126, 'cash', 'Round up');
    assert.strictEqual(rounded.ok, true);
    assert.strictEqual(rounded.settlement.amount, 10.13);
    assert.strictEqual(rounded.customer.totalSettled, 1210.14);
    assert.strictEqual(rounded.customer.balance, 1221.87);
  });
});

test('Issue #409 Ledger Credit Limit Alignment & Paisa Precision - Fixes & Routes', function (t) {
  t.test('listCustomers unifies creditLimit null/undefined/non-finite to 5000 and preserves 0 and "0"', function () {
    var db = {
      customers: [
        { id: 1, name: 'Zero Num', creditLimit: 0 },
        { id: 2, name: 'Zero Str', creditLimit: '0' },
        { id: 3, name: 'Null Limit', creditLimit: null },
        { id: 4, name: 'Undefined Limit' },
        { id: 5, name: 'NaN Limit', creditLimit: 'invalid' },
        { id: 6, name: 'Infinity Limit', creditLimit: Infinity }
      ]
    };

    var list = ledger.listCustomers(db);
    assert.strictEqual(list[0].creditLimit, 0);
    assert.strictEqual(list[1].creditLimit, 0);
    assert.strictEqual(list[2].creditLimit, 5000);
    assert.strictEqual(list[3].creditLimit, 5000);
    assert.strictEqual(list[4].creditLimit, 5000);
    assert.strictEqual(list[5].creditLimit, 5000);
    assert.deepEqual(ledger.listCustomers(null), []);
  });

  t.test('chargeOrderToKhata enforces creditLimit 0 / "0" with currentBalance <= 0 vs > 0', function () {
    var db = {
      customers: [
        { id: 1, name: 'Zero Exact', creditLimit: 0, openingBalance: 0, totalBilled: 0, totalSettled: 0, balance: 0 },
        { id: 2, name: 'Advance Credit', creditLimit: '0', openingBalance: 0, totalBilled: 0, totalSettled: 200, balance: -200 },
        { id: 3, name: 'Already Over', creditLimit: 0, openingBalance: 50, totalBilled: 0, totalSettled: 0, balance: 50 }
      ]
    };

    // currentBalance = 0, small positive total rejected
    var failTiny = ledger.chargeOrderToKhata(db, 1, 0.01);
    assert.strictEqual(failTiny.ok, false);
    assert.match(failTiny.error, /Limit: ₹0/);
    assert.strictEqual(db.customers[0].totalBilled, 0);

    // currentBalance = 0, orderTotal = 0 allowed (projected === 0 <= 0)
    var okZero = ledger.chargeOrderToKhata(db, 1, 0);
    assert.strictEqual(okZero.ok, true);
    assert.strictEqual(db.customers[0].balance, 0);

    // currentBalance = -200, orderTotal = 150 -> projected -50 <= 0 (allowed)
    var okAdvance1 = ledger.chargeOrderToKhata(db, 2, 150);
    assert.strictEqual(okAdvance1.ok, true);
    assert.strictEqual(db.customers[1].totalBilled, 150);
    assert.strictEqual(db.customers[1].balance, -50);

    // currentBalance = -50, orderTotal = 50 -> projected 0 <= 0 (allowed)
    var okAdvance2 = ledger.chargeOrderToKhata(db, 2, 50);
    assert.strictEqual(okAdvance2.ok, true);
    assert.strictEqual(db.customers[1].totalBilled, 200);
    assert.strictEqual(db.customers[1].balance, 0);

    // currentBalance = 0, orderTotal = 0.01 -> projected 0.01 > 0 (rejected)
    var failAdvance = ledger.chargeOrderToKhata(db, 2, 0.01);
    assert.strictEqual(failAdvance.ok, false);
    assert.strictEqual(db.customers[1].totalBilled, 200);

    // currentBalance = 50 > 0, even orderTotal = 0 exceeds limit 0
    var failOverZero = ledger.chargeOrderToKhata(db, 3, 0);
    assert.strictEqual(failOverZero.ok, false);
    assert.match(failOverZero.error, /Limit: ₹0/);
  });

  t.test('chargeOrderToKhata enforces 5000 default when creditLimit is null or undefined and rejects invalid orderTotals', function () {
    var db = {
      customers: [
        { id: 1, name: 'Null Limit', creditLimit: null, openingBalance: '100', totalBilled: '0', totalSettled: '0', balance: 100 },
        { id: 2, name: 'Undef Limit', openingBalance: 0, totalBilled: 0, totalSettled: 0, balance: 0 }
      ]
    };

    var okNull = ledger.chargeOrderToKhata(db, 1, 4900);
    assert.strictEqual(okNull.ok, true);
    assert.strictEqual(okNull.customer.totalBilled, 4900);
    assert.strictEqual(okNull.customer.balance, 5000);

    var failNull = ledger.chargeOrderToKhata(db, 1, 0.01);
    assert.strictEqual(failNull.ok, false);
    assert.match(failNull.error, /Limit: ₹5000/);

    var failUndef = ledger.chargeOrderToKhata(db, 2, 5000.01);
    assert.strictEqual(failUndef.ok, false);
    assert.match(failUndef.error, /Limit: ₹5000/);

    var badTotals = [null, undefined, true, false, '', '   ', NaN, Infinity, -Infinity, 'Infinity', -10, [100]];
    for (var i = 0; i < badTotals.length; i++) {
      var res = ledger.chargeOrderToKhata(db, 2, badTotals[i]);
      assert.strictEqual(res.ok, false, 'Expected invalid orderTotal rejection at index ' + i);
      assert.strictEqual(res.error, 'Invalid order total for Khata billing');
      assert.strictEqual(db.customers[1].totalBilled, 0);
      assert.strictEqual(db.customers[1].balance, 0);
    }
  });

  t.test('reverseOrderDebit guards invalid totals and coerces string ledger fields safely', function () {
    var db = {
      customers: [
        { id: 1, name: 'Test', openingBalance: '100', totalBilled: '300', totalSettled: '50', balance: 350 }
      ]
    };

    var ignored = [null, undefined, true, false, '', '   ', NaN, Infinity, -Infinity, 0, -25, [100]];
    for (var i = 0; i < ignored.length; i++) {
      ledger.reverseOrderDebit(db, 1, ignored[i]);
      assert.strictEqual(db.customers[0].totalBilled, '300');
    }

    ledger.reverseOrderDebit(db, 1, '125.50');
    assert.strictEqual(db.customers[0].totalBilled, 174.5);
    assert.strictEqual(db.customers[0].balance, 224.5);
  });

  t.test('settlement paisa precision, symmetric negative rounding, and -0 avoidance', function () {
    var db = {
      nextSettlementId: 501,
      customers: [
        { id: 1, name: 'Precision', openingBalance: 0, totalBilled: 100, totalSettled: 0, balance: 100 },
        { id: 2, name: 'Overpaid', openingBalance: -1.005, totalBilled: 0, totalSettled: 0, balance: -1.005 },
        { id: 3, name: 'Near Zero', openingBalance: -0.004, totalBilled: 0, totalSettled: 0, balance: -0.004 }
      ],
      settlements: []
    };

    // Sub-paisa string '0.004' rejected
    var subStr = ledger.recordSettlement(db, 1, '0.004', 'upi', 'Sub-paisa str');
    assert.strictEqual(subStr.ok, false);

    // String '0.005' -> 0.01
    var halfStr = ledger.recordSettlement(db, 1, '0.005', 'upi', 'Half str');
    assert.strictEqual(halfStr.ok, true);
    assert.strictEqual(halfStr.settlement.amount, 0.01);
    assert.strictEqual(halfStr.customer.totalSettled, 0.01);
    assert.strictEqual(halfStr.customer.balance, 99.99);

    // Three 10.004 settlements -> totalSettled adds exactly 30
    for (var i = 0; i < 3; i++) {
      var r = ledger.recordSettlement(db, 1, 10.004, 'cash', 'Batch ' + i);
      assert.strictEqual(r.ok, true);
      assert.strictEqual(r.settlement.amount, 10);
    }
    assert.strictEqual(db.customers[0].totalSettled, 30.01);
    assert.strictEqual(db.customers[0].balance, 69.99);

    // Settling exact remaining balance produces +0, never -0
    var zeroOut = ledger.recordSettlement(db, 1, 69.99, 'upi', 'Clear');
    assert.strictEqual(zeroOut.ok, true);
    assert.strictEqual(zeroOut.customer.balance, 0);
    assert.strictEqual(Object.is(zeroOut.customer.balance, -0), false);

    // Symmetric negative rounding (-1.005 -> -1.01) and -0.004 -> +0
    var listed = ledger.listCustomers(db);
    assert.strictEqual(listed[1].openingBalance, -1.01);
    assert.strictEqual(listed[1].balance, -1.01);
    assert.strictEqual(listed[2].openingBalance, 0);
    assert.strictEqual(Object.is(listed[2].openingBalance, -0), false);
    assert.strictEqual(listed[2].balance, 0);
    assert.strictEqual(Object.is(listed[2].balance, -0), false);
  });

  t.test('HTTP GET /api/customers and POST /api/customers/:id/settle enforce creditLimit 0, 404, 400, and audit precision', async function () {
    var db = {
      nextSettlementId: 501,
      customers: [
        { id: 1, name: 'Meera Joshi', creditLimit: 5000, openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200, balance: 1232.01 },
        { id: 2, name: 'Zero Limit', creditLimit: 0, openingBalance: 0, totalBilled: 0, totalSettled: 0, balance: 0 },
        { id: 3, name: 'Null Limit', creditLimit: null, openingBalance: 0, totalBilled: 100, totalSettled: 0, balance: 100 },
        { id: 4, name: 'Str Zero Limit', creditLimit: '0', openingBalance: 0, totalBilled: 0, totalSettled: 0, balance: 0 }
      ],
      settlements: [],
      auditLog: []
    };

    await withMockedCustomerServer(db, async function (ctx) {
      var listRes = await requestJson(ctx.port, 'GET', '/api/customers');
      assert.strictEqual(listRes.status, 200);
      assert.strictEqual(listRes.body.customers[1].creditLimit, 0);
      assert.strictEqual(listRes.body.customers[2].creditLimit, 5000);
      assert.strictEqual(listRes.body.customers[3].creditLimit, 0);

      // 404 for unknown customer
      var notFoundRes = await requestJson(ctx.port, 'POST', '/api/customers/999/settle', {
        amount: 100,
        mode: 'upi'
      });
      assert.strictEqual(notFoundRes.status, 404);
      assert.deepEqual(notFoundRes.body, { error: 'Customer not found' });
      assert.strictEqual(ctx.getWriteCount(), 0);
      assert.strictEqual(ctx.getAuditCalls().length, 0);

      // 400 rejections leave db unwritten
      var badPayloads = [
        {},
        { amount: '' },
        { amount: '   ' },
        { amount: 0 },
        { amount: -5 },
        { amount: 0.004 },
        { amount: '0.004' },
        { amount: 'Infinity' },
        { amount: true }
      ];
      for (var i = 0; i < badPayloads.length; i++) {
        var badRes = await requestJson(ctx.port, 'POST', '/api/customers/1/settle', badPayloads[i]);
        assert.strictEqual(badRes.status, 400, 'Expected 400 for payload index ' + i);
        assert.strictEqual(badRes.body.error, 'Settlement amount must be greater than zero');
        assert.strictEqual(ctx.getWriteCount(), 0);
      }

      // 201 rounded paisa settlement + audit log agrees with rounded amount
      var okRes = await requestJson(ctx.port, 'POST', '/api/customers/1/settle', {
        amount: '10.126',
        mode: 'upi',
        note: 'Paisa test'
      });
      assert.strictEqual(okRes.status, 201);
      assert.strictEqual(okRes.body.ok, true);
      assert.strictEqual(okRes.body.settlement.amount, 10.13);
      assert.strictEqual(okRes.body.customer.totalSettled, 1210.13);
      assert.strictEqual(okRes.body.customer.balance, 1221.88);
      assert.strictEqual(ctx.getWriteCount(), 1);
      assert.strictEqual(ctx.getAuditCalls().length, 1);
      assert.strictEqual(ctx.getAuditCalls()[0].details, 'Meera Joshi settled ₹10.13 via UPI');
      assert.strictEqual(ctx.getDbState().auditLog[0].details, 'Meera Joshi settled ₹10.13 via UPI');
    });
  });
});
