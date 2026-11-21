// ====================================================================
// Ticket 3: order dates and Khata settlements
// ====================================================================
var test = require('node:test');
var assert = require('node:assert/strict');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');

// ====================================================================
// orders.list
// Covers: Ticket 3, chronological order and inclusive date filters
// Cases:
//   [x] newest date first across years and months
//   [x] date range includes both boundaries
//   [x] sorting preserves all orders on the same date
// ====================================================================
test('should sort orders newest first across years', function () {
  var db = {orders: [{id: 1, date: '28/12/2021'}, {id: 4, date: '30/01/2022'}, {id: 8, date: '15/03/2022'}]};

  var result = orders.list(db);

  assert.deepEqual(result.map(function (o) { return o.id; }), [8, 4, 1]);
});
test('should include boundary dates and exclude dates outside the range', function () {
  var db = {orders: [{id: 1, date: '28/12/2021'}, {id: 4, date: '30/01/2022'}, {id: 8, date: '15/03/2022'}, {id: 9, date: '16/03/2022'}]};

  var result = orders.list(db, {from: '2022-01-30', to: '2022-03-15'});

  assert.deepEqual(result.map(function (o) { return o.id; }), [8, 4]);
});
test('should preserve input order when dates are equal', function () {
  var db = {orders: [{id: 1, date: '15/03/2022'}, {id: 2, date: '15/03/2022'}]};

  var result = orders.list(db);

  assert.deepEqual(result.map(function (o) { return o.id; }), [1, 2]);
});

// ====================================================================
// ledger.recordSettlement
// Covers: Ticket 3, numeric Khata payments and balance
// Cases:
//   [x] string payment adds numerically to the existing total
//   [x] numeric fractional payment rounds the balance
//   [x] nonnumeric and nonfinite payments are rejected without mutation
//   [x] zero and negative payments are rejected
//   [x] unknown customer is rejected
// ====================================================================
test('should add string settlement amounts numerically', function () {
  var db = {customers: [{id: 1, name: 'Meera', totalBilled: 2432.01, totalSettled: 1200}], nextSettlementId: 1};

  var result = ledger.recordSettlement(db, 1, '500');

  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});
test('should calculate fractional numeric settlements accurately', function () {
  var db = {customers: [{id: 1, totalBilled: 10, totalSettled: 0}], nextSettlementId: 1};

  var result = ledger.recordSettlement(db, 1, 2.35);

  assert.equal(result.customer.balance, 7.65);
});
test('should reject nonnumeric and nonfinite amounts without changing state', function () {
  var db = {customers: [{id: 1, totalBilled: 10, totalSettled: 0}], nextSettlementId: 1};

  var result = ['abc', Infinity, 'Infinity'].map(function (amount) { return ledger.recordSettlement(db, 1, amount); });

  assert.deepEqual(result.map(function (r) { return r.ok; }), [false, false, false]);
  assert.equal(db.customers[0].totalSettled, 0);
  assert.equal(db.nextSettlementId, 1);
});
test('should reject zero and negative settlement amounts', function () {
  var db = {customers: [{id: 1}], nextSettlementId: 1};

  var result = [0, -1, ''].map(function (amount) { return ledger.recordSettlement(db, 1, amount); });

  assert.deepEqual(result.map(function (r) { return r.ok; }), [false, false, false]);
});
test('should reject settlements for unknown customers', function () {
  var db = {customers: [], nextSettlementId: 1};

  var result = ledger.recordSettlement(db, 1, 10);

  assert.equal(result.error, 'Customer not found');
});
