const test = require('node:test');
const assert = require('node:assert/strict');
const ledger = require('../lib/ledger');

test('settlement amount from an HTML input is added numerically to the customer ledger', () => {
  const db = {
    customers: [{
      id: 7,
      name: 'Meera Joshi',
      openingBalance: 0,
      totalBilled: 2432.01,
      totalSettled: 1200
    }],
    nextSettlementId: 1,
    settlements: []
  };

  const result = ledger.recordSettlement(db, 7, '500', 'upi', '');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});
