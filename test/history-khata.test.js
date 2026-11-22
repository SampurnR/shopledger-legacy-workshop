// Characterization tests for Order History (lib/orders.js, lib/dates.js) and
// Khata settlements (lib/ledger.js) for Ticket 3.
// All data is in-memory. These tests never read or write data/db.json.
var test = require('node:test');
var assert = require('node:assert/strict');

var orders = require('../lib/orders');
var dates = require('../lib/dates');
var ledger = require('../lib/ledger');

function o(id, date, extra) {
  var base = { id: id, date: date, customer: 'Walk-in', status: 'completed', coupon: '', items: [], total: 100 };
  return Object.assign(base, extra || {});
}

function ordersDb() {
  return {
    orders: [
      o(1001, '28/12/2021', { customer: 'Meera Joshi' }),
      o(1002, '05/01/2022', { customer: 'Anil Kulkarni', coupon: 'SAVE10' }),
      o(1003, '14/01/2022', { coupon: 'FLAT50' }),
      o(1004, '30/01/2022', { customer: 'Kalyani Foods (Wholesale)', coupon: 'SAVE10' }),
      o(1005, '02/02/2022', { customer: 'Priya Nair', coupon: 'FLAT50' }),
      o(1006, '18/02/2022', { customer: 'Meera Joshi', coupon: 'WELCOME' }),
      o(1007, '04/03/2022', { customer: 'Suresh Deshmukh', status: 'pending' }),
      o(1008, '15/03/2022')
    ]
  };
}

function ids(list) { return list.map(function (x) { return x.id; }); }

function customersDb() {
  return {
    nextSettlementId: 505,
    settlements: [],
    customers: [
      { id: 1, name: 'Meera Joshi', creditLimit: 5000, openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200, balance: 1232.01 }
    ]
  };
}

// ---------- Behaviour that is correct today ----------

test('status filter returns only matching orders', function () {
  assert.deepEqual(ids(orders.list(ordersDb(), { status: 'pending' })), [1007]);
});

test('search matches customer name, coupon, and order id', function () {
  assert.deepEqual(ids(orders.list(ordersDb(), { search: 'meera' })).sort(), [1001, 1006]);
  assert.deepEqual(ids(orders.list(ordersDb(), { search: 'welcome' })), [1006]);
  assert.deepEqual(ids(orders.list(ordersDb(), { search: '1008' })), [1008]);
});

test('normalizeDateKey converts YYYY-MM-DD to DD/MM/YYYY and leaves DD/MM/YYYY alone', function () {
  assert.equal(dates.normalizeDateKey('2022-01-31'), '31/01/2022');
  assert.equal(dates.normalizeDateKey('31/01/2022'), '31/01/2022');
  assert.equal(dates.normalizeDateKey(''), '');
});

test('getFiscalYear uses April as the first month', function () {
  assert.equal(dates.getFiscalYear('15/03/2022'), 'FY21-22');
  assert.equal(dates.getFiscalYear('01/04/2022'), 'FY22-23');
});

test('settlement with a numeric amount updates totals correctly', function () {
  var db = customersDb();
  var r = ledger.recordSettlement(db, 1, 500, 'cash', '');
  assert.equal(r.ok, true);
  assert.equal(r.customer.totalSettled, 1700);
  assert.equal(r.customer.balance, 732.01);
  assert.equal(db.settlements[0].amount, 500);
});

test('settlement rejects zero, negative, and unknown customer', function () {
  assert.equal(ledger.recordSettlement(customersDb(), 1, 0).ok, false);
  assert.equal(ledger.recordSettlement(customersDb(), 1, -5).ok, false);
  assert.equal(ledger.recordSettlement(customersDb(), 99, 10).ok, false);
});

// ---------- Formerly CURRENT BEHAVIOUR: updated after the Ticket 3 fix ----------

test('UPDATED (was CURRENT BEHAVIOUR): "newest first" puts #1008 (15/03/2022) on top and #1001 last', function () {
  var r = ids(orders.list(ordersDb(), {}));
  assert.equal(r[0], 1008);
  assert.equal(r[r.length - 1], 1001);
});

test('UPDATED (was CURRENT BEHAVIOUR): January 2022 date filter returns only January orders', function () {
  var r = orders.list(ordersDb(), { from: '2022-01-01', to: '2022-01-31' });
  assert.equal(r.length, 3);
});

test('UPDATED (was CURRENT BEHAVIOUR): December 2021 date filter returns only #1001', function () {
  var r = orders.list(ordersDb(), { from: '2021-12-01', to: '2021-12-31' });
  assert.equal(r.length, 1);
});

test('UPDATED (was CURRENT BEHAVIOUR): ₹500 settlement sent as text makes Total Settled 1700', function () {
  var db = customersDb();
  var r = ledger.recordSettlement(db, '1', '500', 'cash', '');
  assert.equal(r.customer.totalSettled, 1700);
  assert.equal(r.customer.balance, 732.01);
});

test('UPDATED (was CURRENT BEHAVIOUR): non-numeric settlement amount "abc" is rejected', function () {
  var r = ledger.recordSettlement(customersDb(), 1, 'abc', 'cash', '');
  assert.equal(r.ok, false);
});

// ---------- CORRECT BEHAVIOUR (Ticket 3) ----------

test('order history is sorted newest first by real date', function () {
  assert.deepEqual(ids(orders.list(ordersDb(), {})), [1008, 1007, 1006, 1005, 1004, 1003, 1002, 1001]);
});

test('date filter returns only orders inside the range (inclusive)', function () {
  assert.deepEqual(ids(orders.list(ordersDb(), { from: '2022-01-01', to: '2022-01-31' })), [1004, 1003, 1002]);
  assert.deepEqual(ids(orders.list(ordersDb(), { from: '2021-12-01', to: '2021-12-31' })), [1001]);
  assert.deepEqual(ids(orders.list(ordersDb(), { from: '2022-03-04' })), [1008, 1007]);
  assert.deepEqual(ids(orders.list(ordersDb(), { to: '2021-12-28' })), [1001]);
});

test('₹500 settlement sent as text adds 500 to Total Settled', function () {
  var db = customersDb();
  var r = ledger.recordSettlement(db, '1', '500', 'cash', '');
  assert.equal(r.ok, true);
  assert.equal(r.customer.totalSettled, 1700);
  assert.equal(r.customer.balance, 732.01);
  assert.equal(db.settlements[0].amount, 500);
});

test('non-numeric settlement amount is rejected and nothing changes', function () {
  var db = customersDb();
  var r = ledger.recordSettlement(db, 1, 'abc', 'cash', '');
  assert.equal(r.ok, false);
  assert.equal(db.customers[0].totalSettled, 1200);
  assert.equal(db.settlements.length, 0);
});
