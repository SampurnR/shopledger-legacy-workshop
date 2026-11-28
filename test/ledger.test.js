'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ledger = require('../lib/ledger');

describe('lib/ledger', () => {
  it('adds numeric and string settlement amounts numerically without string concatenation', () => {
    const db = {
      nextSettlementId: 505,
      customers: [
        {
          id: 1,
          name: 'Meera Joshi',
          openingBalance: 450,
          totalBilled: 1982.01,
          totalSettled: 1200,
          balance: 1232.01
        }
      ],
      settlements: []
    };

    const res = ledger.recordSettlement(db, 1, '500', 'upi', 'Partial payment');
    assert.equal(res.ok, true);
    assert.equal(res.customer.totalSettled, 1700);
    assert.equal(res.customer.balance, 732.01);
  });
});
