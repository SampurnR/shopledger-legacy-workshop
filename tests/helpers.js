var assert = require('node:assert/strict');
var store = require('../lib/store');
var dates = require('../lib/dates');

exports.clone = function (value) {
  return JSON.parse(JSON.stringify(value));
};

exports.createDb = function () {
  return {
    nextOrderId: 1001,
    nextSettlementId: 501,
    products: [
      { id: 1, sku: 'RICE', name: 'Test Rice', hsn: '1006', price: 640, stock: 18, reserved: 2 },
      { id: 2, sku: 'TEA', name: 'Test Tea', hsn: '0902', price: 140, stock: 42, reserved: 0 },
      { id: 3, sku: 'OIL', name: 'Test Oil', hsn: '1508', price: 1120, stock: 9, reserved: 1 }
    ],
    customers: [
      { id: 1, name: 'Test Customer', creditLimit: 5000, openingBalance: 50,
        totalBilled: 500, totalSettled: 100, balance: 450 }
    ],
    orders: [],
    settlements: [],
    auditLog: []
  };
};

// Exercise real synchronous route handlers and business modules, without opening
// a socket or invoking real persistence. Each test receives a fresh fake store.
exports.createRouteHarness = function (t, initialDb) {
  var persisted = exports.clone(initialDb || exports.createDb());
  var writes = 0;
  t.mock.method(store, 'read', function () { return exports.clone(persisted); });
  t.mock.method(store, 'write', function (db) {
    persisted = exports.clone(db);
    writes++;
  });
  t.mock.method(dates, 'today', function () { return '15/04/2022'; });

  return {
    db: function () { return exports.clone(persisted); },
    writes: function () { return writes; },
    invoke: function (router, method, path, body, params, query) {
      var layer = router.stack.find(function (entry) {
        return entry.route && entry.route.path === path && entry.route.methods[method];
      });
      assert.ok(layer, 'Expected route: ' + method + ' ' + path);
      var response = {
        statusCode: 200,
        body: undefined,
        status: function (code) { this.statusCode = code; return this; },
        json: function (value) { this.body = exports.clone(value); return this; }
      };
      layer.route.stack[0].handle({ body: body || {}, params: params || {}, query: query || {} }, response);
      return response;
    }
  };
};
