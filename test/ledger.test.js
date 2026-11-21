var test = require('node:test');
var assert = require('node:assert/strict');

var ledger = require('../lib/ledger');

test('string settlement amount is added numerically to the customer totals', function () {
  var db = {
    nextSettlementId: 505,
    settlements: [],
    customers: [{
      id: 1,
      name: 'Meera Joshi',
      openingBalance: 450,
      totalBilled: 1982.01,
      totalSettled: 1200
    }]
  };

  var result = ledger.recordSettlement(db, 1, '500', 'upi', 'Characterization');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});
