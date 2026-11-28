const assert = require('node:assert/strict');
const test = require('node:test');
const dates = require('../lib/dates');
const orders = require('../lib/orders');

function filteredIds(filters) {
  const db = {
    orders: [
      { id: 101, date: '01/01/2024', customer: 'Asha Rao', status: 'completed' },
      { id: 102, date: '02/01/2024', customer: 'Asha Patel', status: 'cancelled' },
      { id: 203, date: '03/01/2024', customer: 'Dev Shah', coupon: 'SAVE10' },
      { id: 304, date: '04/01/2024', status: 'pending' }
    ]
  };
  return orders.list(db, filters).map(order => order.id);
}

test('status filtering includes legacy orders without a status as completed', () => {
  assert.deepEqual(filteredIds({ status: 'completed' }), [203, 101]);
  assert.deepEqual(filteredIds({ status: 'cancelled' }), [102]);
  assert.deepEqual(filteredIds({ status: 'pending' }), [304]);
  assert.deepEqual(filteredIds({ status: 'all' }), [304, 203, 102, 101]);
  assert.deepEqual(filteredIds(), [304, 203, 102, 101]);
});

test('search matches partial IDs, customer names, coupons and the walk-in fallback', () => {
  assert.deepEqual(filteredIds({ search: '  ASHA ' }), [102, 101]);
  assert.deepEqual(filteredIds({ search: '03' }), [203]);
  assert.deepEqual(filteredIds({ search: ' save ' }), [203]);
  assert.deepEqual(filteredIds({ search: 'WALK-IN' }), [304]);
  assert.deepEqual(filteredIds({ search: 'missing' }), []);
});

test('status and search filters intersect', () => {
  assert.deepEqual(filteredIds({ status: 'completed', search: 'asha' }), [101]);
  assert.deepEqual(filteredIds({ status: 'cancelled', search: 'asha' }), [102]);
  assert.deepEqual(filteredIds({ status: 'cancelled', search: 'save' }), []);
});

test('Order History sorts newest first across months and years', () => {
  const db = {
    orders: [
      { id: 1, date: '01/02/2024' },
      { id: 2, date: '31/01/2024' },
      { id: 3, date: '31/12/2023' },
      { id: 4, date: '01/01/2024' }
    ]
  };
  assert.deepEqual(orders.list(db).map(order => order.id), [1, 2, 4, 3]);
});

test('January date range excludes December and February orders and includes both endpoints', () => {
  const db = {
    orders: [
      { id: 1, date: '15/01/2024' },
      { id: 2, date: '14/12/2023' },
      { id: 3, date: '16/02/2024' },
      { id: 4, date: '09/01/2024' },
      { id: 5, date: '21/01/2024' },
      { id: 6, date: '10/01/2024' },
      { id: 7, date: '20/01/2024' }
    ]
  };
  const january = orders.list(db, { from: '2024-01-10', to: '2024-01-20' });
  assert.deepEqual(january.map(order => order.id), [7, 1, 6]);
});

test('date normalization trims input and converts ISO dates to day-first keys', () => {
  assert.equal(dates.normalizeDateKey(' 2024-01-09 '), '09/01/2024');
  assert.equal(dates.normalizeDateKey(' 09/01/2024 '), '09/01/2024');
  assert.equal(dates.normalizeDateKey(''), '');
});

test('fiscal year changes in April and falls back for an unrecognized date shape', () => {
  assert.equal(dates.getFiscalYear('01/01/2024'), 'FY23-24');
  assert.equal(dates.getFiscalYear('31/03/2024'), 'FY23-24');
  assert.equal(dates.getFiscalYear('2024-04-01'), 'FY24-25');
  assert.equal(dates.getFiscalYear(''), 'FY21-22');
});
