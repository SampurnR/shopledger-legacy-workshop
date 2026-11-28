'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const dates = require('../lib/dates');
const orders = require('../lib/orders');

describe('lib/orders & lib/dates', () => {
  it('sorts orders newest first across months and years', () => {
    const db = {
      orders: [
        { id: 1001, date: '28/12/2021', customer: 'Meera Joshi', status: 'completed' },
        { id: 1004, date: '30/01/2022', customer: 'Kalyani Foods', status: 'completed' },
        { id: 1008, date: '15/03/2022', customer: 'Walk-in', status: 'completed' }
      ]
    };

    const sorted = orders.list(db);
    assert.deepEqual(sorted.map((o) => o.id), [1008, 1004, 1001]);
  });

  it('filters orders by date range using YYYY-MM-DD or DD/MM/YYYY inputs', () => {
    const db = {
      orders: [
        { id: 1001, date: '28/12/2021', customer: 'Meera Joshi', status: 'completed' },
        { id: 1004, date: '30/01/2022', customer: 'Kalyani Foods', status: 'completed' },
        { id: 1008, date: '15/03/2022', customer: 'Walk-in', status: 'completed' }
      ]
    };

    const filtered = orders.list(db, { from: '2022-01-01', to: '2022-02-28' });
    assert.deepEqual(filtered.map((o) => o.id), [1004]);
  });

  it('computes fiscal year accurately for both DD/MM/YYYY and YYYY-MM-DD', () => {
    assert.equal(dates.getFiscalYear('15/03/2022'), 'FY21-22');
    assert.equal(dates.getFiscalYear('01/04/2022'), 'FY22-23');
    assert.equal(dates.getFiscalYear('2022-03-15'), 'FY21-22');
  });
});
