var test = require('node:test');
var assert = require('node:assert/strict');
var ledger = require('../lib/ledger');

test('Ledger Module - Ticket 3 (#3) & #409 Khata Settlements & Credit Suite', function (t) {
  function createLedgerDb() {
    return {
      nextSettlementId: 505,
      customers: [
        {
          id: 1,
          name: 'Meera Joshi',
          creditLimit: 5000,
          openingBalance: 450,
          totalBilled: 1982.01,
          totalSettled: 1200,
          balance: 1232.01
        },
        {
          id: 2,
          name: 'Zero Limit Customer',
          creditLimit: 0,
          openingBalance: 0,
          totalBilled: 0,
          totalSettled: 0,
          balance: 0
        }
      ],
      settlements: []
    };
  }

  t.test('Settlement payment with string amount adds numerically without string concatenation (Issue #3)', function () {
    var db = createLedgerDb();
    // In legacy code, passing "500" caused totalSettled to become "1200500" and balance to become -1198067.99
    var res = ledger.recordSettlement(db, 1, '500', 'upi', 'Part payment');

    assert.equal(res.ok, true);
    assert.equal(res.customer.totalSettled, 1700, 'Total Settled should be 1200 + 500 = 1700 (numeric)');
    assert.equal(res.customer.balance, 732.01, 'Balance Due should be 450 + 1982.01 - 1700 = 732.01');
    assert.equal(res.settlement.amount, 500, 'Settlement entry amount should be numeric 500');
    assert.equal(db.settlements.length, 1);
  });

  t.test('Settlement payment with float number adds accurately', function () {
    var db = createLedgerDb();
    var res = ledger.recordSettlement(db, 1, 232.01, 'cash', 'Full settlement');

    assert.equal(res.ok, true);
    assert.equal(res.customer.totalSettled, 1432.01);
    assert.equal(res.customer.balance, 1000.0);
  });

  t.test('Khata credit limit of 0 is preserved in customer listing and enforced at checkout (Issue #409)', function () {
    var db = createLedgerDb();
    var list = ledger.listCustomers(db);

    var zeroCust = list.find(function (c) { return c.id === 2; });
    assert.equal(zeroCust.creditLimit, 0, 'creditLimit 0 must not fall back to 5000 default');

    var chargeRes = ledger.chargeOrderToKhata(db, 2, 100);
    assert.equal(chargeRes.ok, false);
    assert.match(chargeRes.error, /Khata credit limit exceeded/);
  });

  t.test('Settlement precision: rejects sub-paisa amounts like 0.004 that round to zero (Issue #409)', function () {
    var db = createLedgerDb();
    var res = ledger.recordSettlement(db, 1, 0.004, 'upi', 'Sub-paisa');

    assert.equal(res.ok, false);
    assert.match(res.error, /must be greater than zero/);
  });

  t.test('Settlement precision: receipt and credited balance agree to the paisa (Issue #409)', function () {
    var db = createLedgerDb();
    var res = ledger.recordSettlement(db, 1, 10.004, 'upi', 'Rounded test');

    assert.equal(res.ok, true);
    assert.equal(res.settlement.amount, 10.0, 'Receipt rounded to paisa');
    assert.equal(res.customer.totalSettled, 1210.0, 'Credited amount rounded to paisa');
  });

  t.test('Rejects invalid or non-existent customer in settlement', function () {
    var db = createLedgerDb();
    var res = ledger.recordSettlement(db, 999, 100);
    assert.equal(res.ok, false);
    assert.match(res.error, /Customer not found/);
  });
});
