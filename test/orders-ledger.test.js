'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const orders = require('../lib/orders');
const ledger = require('../lib/ledger');

test('orders sort and filter by real dates, and settlements stay numeric and valid', async (t) => {
  await t.test('filters February dates and sorts newest first', () => {
    const db = {
      orders: [
        { id: 1, date: '05/01/2022', status: 'completed' },
        { id: 2, date: '18/02/2022', status: 'completed' },
        { id: 3, date: '04/03/2022', status: 'completed' },
        { id: 4, date: '02/02/2022', status: 'completed' }
      ]
    };

    const result = orders.list(db, {
      status: 'all',
      from: '2022-02-01',
      to: '2022-02-28'
    });

    assert.deepEqual(result.map((order) => order.id), [2, 4]);
  });

  await t.test('treats settlement strings as numbers and rejects invalid amounts', () => {
    const customer = {
      id: 1,
      name: 'Meera Joshi',
      openingBalance: 450,
      totalBilled: 1982.01,
      totalSettled: 1200,
      creditLimit: 5000
    };
    const db = { customers: [customer], settlements: [], nextSettlementId: 505 };

    const settlement = ledger.recordSettlement(db, 1, '500', 'upi', 'cash settlement');

    assert.equal(settlement.ok, true);
    assert.equal(typeof customer.totalSettled, 'number');
    assert.equal(customer.totalSettled, 1700);
    assert.equal(customer.balance, 732.01);
    assert.equal(typeof settlement.settlement.amount, 'number');
    assert.equal(settlement.settlement.amount, 500);

    const before = { ...customer };
    for (const amount of ['not-a-number', 0, -1, null, true]) {
      const invalid = ledger.recordSettlement(db, 1, amount, 'upi', 'invalid');
      assert.equal(invalid.ok, false);
      assert.deepEqual(customer, before);
    }
    assert.equal(db.settlements.length, 1);
  });
});
