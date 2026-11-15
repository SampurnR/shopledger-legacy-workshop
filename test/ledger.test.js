'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var ledger = require('../lib/ledger');
var fixtures = require('../test-support/fixtures');

test('a browser string settlement updates numeric totals without concatenation', function () {
  var db = fixtures.ledgerDb();
  var result = ledger.recordSettlement(db, 1, '500', 'upi', 'Ticket 3');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});

test('numeric strings in existing settled totals remain numeric after payment', function () {
  var db = fixtures.ledgerDb();
  db.customers[0].totalSettled = '1200';
  assert.equal(ledger.recordSettlement(db, 1, '500').customer.totalSettled, 1700);
});

test('settlement arithmetic and stored payments are rounded to currency precision', function () {
  var db = fixtures.ledgerDb();
  db.customers[0].totalSettled = 0.1;
  var result = ledger.recordSettlement(db, 1, '0.2');
  assert.equal(result.customer.totalSettled, 0.3);
  assert.equal(result.customer.balance, 2431.71);
  var rounded = ledger.recordSettlement(db, 1, 1.005);
  assert.equal(rounded.settlement.amount, 1.01);
  assert.equal(rounded.customer.totalSettled, 1.31);
});

test('successive string payments increase totals and allocate unique settlement IDs', function () {
  var db = fixtures.ledgerDb();
  ledger.recordSettlement(db, 1, '500');
  var result = ledger.recordSettlement(db, 1, '100');
  assert.equal(result.customer.totalSettled, 1800);
  assert.equal(result.customer.balance, 632.01);
  assert.deepEqual(db.settlements.map(function (entry) { return entry.id; }), [502, 501]);
  assert.equal(db.nextSettlementId, 503);
});

[
  ['NaN', NaN], ['infinity', Infinity], ['negative infinity', -Infinity],
  ['nonnumeric string', 'abc'], ['whitespace', '  '], ['infinity string', 'Infinity'],
  ['boolean true', true], ['boolean false', false], ['array', []], ['numeric array', [500]],
  ['object', {}], ['sub-cent amount rounded to zero', 0.001],
  ['finite amount overflowing currency rounding', Number.MAX_VALUE]
].forEach(function (entry) {
  test('invalid settlement is rejected without mutation: ' + entry[0], function () {
    var db = fixtures.ledgerDb();
    var before = structuredClone(db);
    assert.equal(ledger.recordSettlement(db, 1, entry[1]).ok, false);
    assert.deepEqual(db, before);
  });
});

test('a numeric settlement updates balance and records the payment', function () {
  var db = fixtures.ledgerDb();
  var result = ledger.recordSettlement(db, '1', 500, 'cash', 'Counter payment');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.customer.openingBalance, 450);
  assert.equal(result.customer.totalBilled, 1982.01);
  assert.equal(result.settlement.id, 501);
  assert.equal(result.settlement.amount, 500);
  assert.equal(result.settlement.mode, 'cash');
  assert.equal(result.settlement.note, 'Counter payment');
  assert.equal(db.nextSettlementId, 502);
  assert.equal(db.settlements[0], result.settlement);
});

test('zero, negative and absent settlements do not mutate the ledger', function () {
  [0, -1, '', undefined, null].forEach(function (amount) {
    var db = fixtures.ledgerDb();
    var before = structuredClone(db);
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false);
    assert.deepEqual(db, before);
  });
});

test('unknown customer does not mutate the ledger', function () {
  var db = fixtures.ledgerDb();
  var before = structuredClone(db);
  assert.equal(ledger.recordSettlement(db, 999, 500).ok, false);
  assert.deepEqual(db, before);
});

test('settlements are prepended and retain default metadata', function () {
  var db = fixtures.ledgerDb();
  var older = { id: 499, amount: 10 };
  db.settlements.push(older);
  var result = ledger.recordSettlement(db, 1, 100);
  assert.equal(db.settlements[1], older);
  assert.equal(result.settlement.mode, 'upi');
  assert.equal(result.settlement.note, 'Khata settlement');
  assert.match(result.settlement.date, /^\d{2}\/\d{2}\/\d{4}$/);
});

test('customer list reports the opening plus billed minus settled balance', function () {
  var db = fixtures.ledgerDb();
  assert.equal(ledger.listCustomers(db)[0].balance, 1232.01);
  ledger.recordSettlement(db, 1, 500);
  assert.equal(ledger.listCustomers(db)[0].balance, 732.01);
});

test('credit limit rejection leaves the customer unchanged', function () {
  var db = fixtures.ledgerDb();
  var before = structuredClone(db);
  assert.equal(ledger.chargeOrderToKhata(db, 1, 6000).ok, false);
  assert.deepEqual(db, before);
});
