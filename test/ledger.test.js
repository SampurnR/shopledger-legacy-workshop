'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var ledger = require('../lib/ledger');
var fixtures = require('../test-support/fixtures');

test('CURRENT BEHAVIOUR: a string settlement concatenates and corrupts the balance', function () {
  var db = fixtures.ledgerDb();
  var result = ledger.recordSettlement(db, 1, '500', 'upi', 'Ticket 3');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, '1200500');
  assert.equal(result.customer.balance, -1198067.99);
  assert.equal(result.settlement.amount, 500);
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
