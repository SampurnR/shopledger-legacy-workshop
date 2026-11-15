var test = require('node:test');
var assert = require('node:assert/strict');
var ledger = require('../lib/ledger');
var dates = require('../lib/dates');
var router = require('../routes/customers');
var helpers = require('./helpers');

// Cover numeric settlement arithmetic and rejection of invalid amounts. Route
// persistence is an isolated in-memory copy, never the application's JSON file.
test('CURRENT BEHAVIOUR: numeric decimal settlement reduces balance and preserves billed totals', function (t) {
  var harness = helpers.createRouteHarness(t);
  var response = harness.invoke(router, 'post', '/customers/:id/settle',
    { amount: 50.25, mode: 'cash', note: 'Test receipt' }, { id: '1' });
  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.body.settlement, {
    id: 501, customerId: 1, customerName: 'Test Customer', date: '15/04/2022',
    amount: 50.25, mode: 'cash', note: 'Test receipt'
  });
  var customer = harness.db().customers[0];
  assert.deepEqual([customer.totalSettled, customer.balance, customer.totalBilled, customer.openingBalance],
    [150.25, 399.75, 500, 50]);
  assert.equal(harness.writes(), 1);
});

test('REGRESSION: UI-shaped decimal string updates totals and the customer listing numerically', function (t) {
  var harness = helpers.createRouteHarness(t);
  var response = harness.invoke(router, 'post', '/customers/:id/settle',
    { amount: '50.25' }, { id: '1' });
  assert.equal(response.statusCode, 201);
  assert.deepEqual([response.body.customer.totalSettled, response.body.customer.balance], [150.25, 399.75]);
  assert.equal(response.body.settlement.amount, 50.25);
  assert.equal(response.body.settlement.mode, 'upi');
  assert.equal(response.body.settlement.note, 'Khata settlement');
  var listing = harness.invoke(router, 'get', '/customers');
  assert.deepEqual([listing.body.customers[0].totalSettled, listing.body.customers[0].balance],
    [150.25, 399.75]);
  assert.equal(listing.body.settlements[0].amount, 50.25);
  assert.equal(harness.db().auditLog[0].action, 'KHATA_SETTLEMENT');
  assert.equal(harness.writes(), 1);
});

test('REGRESSION: repeated string settlements accumulate numeric totals and receipts', function (t) {
  var harness = helpers.createRouteHarness(t);
  harness.invoke(router, 'post', '/customers/:id/settle', { amount: '50' }, { id: '1' });
  var response = harness.invoke(router, 'post', '/customers/:id/settle', { amount: '25' }, { id: '1' });
  assert.equal(response.statusCode, 201);
  var saved = harness.db();
  assert.deepEqual([saved.customers[0].totalSettled, saved.customers[0].balance], [175, 375]);
  assert.deepEqual(saved.settlements.map(function (receipt) { return [receipt.id, receipt.amount]; }),
    [[502, 25], [501, 50]]);
  assert.equal(saved.nextSettlementId, 503);
  assert.equal(saved.auditLog.length, 2);
  assert.equal(harness.writes(), 2);
});

test('CURRENT BEHAVIOUR: zero, negative, empty and missing amounts return 400 without persistence', function (t) {
  var harness = helpers.createRouteHarness(t);
  var before = harness.db();
  [0, '0', -1, '-1', '', null, undefined].forEach(function (amount) {
    var response = harness.invoke(router, 'post', '/customers/:id/settle', { amount: amount }, { id: '1' });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error, 'Settlement amount must be greater than zero');
    assert.deepEqual(harness.db(), before);
  });
  assert.equal(harness.writes(), 0);
});

test('CURRENT BEHAVIOUR: unknown customer returns 400 without a receipt or balance update', function (t) {
  var harness = helpers.createRouteHarness(t);
  var before = harness.db();
  var response = harness.invoke(router, 'post', '/customers/:id/settle', { amount: '50' }, { id: '999' });
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, 'Customer not found');
  assert.deepEqual(harness.db(), before);
  assert.equal(harness.writes(), 0);
});

test('CURRENT BEHAVIOUR: numeric overpayment is accepted and produces a negative balance', function (t) {
  var harness = helpers.createRouteHarness(t);
  var response = harness.invoke(router, 'post', '/customers/:id/settle', { amount: 600 }, { id: '1' });
  assert.equal(response.statusCode, 201);
  assert.deepEqual([harness.db().customers[0].totalSettled, harness.db().customers[0].balance], [700, -150]);
  assert.equal(harness.writes(), 1);
});

test('REGRESSION: nonnumeric string fails ledger validation without changing money', function (t) {
  t.mock.method(dates, 'today', function () { return '15/04/2022'; });
  var db = helpers.createDb();
  var before = helpers.clone(db);
  var result = ledger.recordSettlement(db, 1, 'oops');
  assert.equal(result.ok, false);
  assert.deepEqual(db, before);
});

test('REGRESSION: settlement route rejects nonnumeric amounts without writing', function (t) {
  var harness = helpers.createRouteHarness(t);
  var before = harness.db();
  var response = harness.invoke(router, 'post', '/customers/:id/settle', { amount: 'oops' }, { id: '1' });
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, 'Settlement amount must be greater than zero');
  assert.deepEqual(harness.db(), before);
  assert.equal(harness.writes(), 0);
});
