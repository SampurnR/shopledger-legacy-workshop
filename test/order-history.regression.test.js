const assert = require('node:assert/strict');
const test = require('node:test');
const dates = require('../lib/dates');
const orders = require('../lib/orders');

function issueFixture() {
  return {
    orders: [
      { id: 1001, date: '28/12/2021', status: 'completed', customer: 'Synthetic Retail' },
      { id: 1004, date: '30/01/2022', status: 'completed', customer: 'Synthetic Retail' },
      { id: 1007, date: '04/03/2022', status: 'cancelled', customer: 'Synthetic Retail' },
      { id: 1008, date: '15/03/2022', customer: 'Synthetic Wholesale', coupon: 'SAVE10' }
    ]
  };
}

function ids(db, filters) {
  return orders.list(db, filters).map(order => order.id);
}

test('Issue #3: Order History shows the reported orders newest first across months and years', () => {
  assert.deepEqual(ids(issueFixture()), [1008, 1007, 1004, 1001]);
});

test('Issue #3: January 2022 contains only order #1004 from the reported fixture', () => {
  assert.deepEqual(ids(issueFixture(), { from: '2022-01-01', to: '2022-01-31' }), [1004]);
});

for (const { label, filters, expected } of [
  {
    label: 'includes both endpoints',
    filters: { from: '2022-01-30', to: '2022-03-04' },
    expected: [1007, 1004]
  },
  {
    label: 'includes an order on a same-day range',
    filters: { from: '2022-01-30', to: '2022-01-30' },
    expected: [1004]
  },
  {
    label: 'supports a from-only filter',
    filters: { from: '2022-01-30' },
    expected: [1008, 1007, 1004]
  },
  {
    label: 'supports a to-only filter',
    filters: { to: '2022-01-30' },
    expected: [1004, 1001]
  },
  {
    label: 'filters across a December to January year boundary',
    filters: { from: '2021-12-28', to: '2022-01-30' },
    expected: [1004, 1001]
  }
]) {
  test(`Date range regression: ${label}`, () => {
    assert.deepEqual(ids(issueFixture(), filters), expected);
  });
}

test('Review regression: equal dates retain their original relative order', () => {
  const db = { orders: [
    { id: 9, date: '02/03/2022' },
    { id: 7, date: '02/03/2022' },
    { id: 8, date: '02/03/2022' }
  ] };
  assert.deepEqual(ids(db), [9, 7, 8]);
  assert.deepEqual(db.orders.map(order => order.id), [9, 7, 8]);
});

test('Review regression: omitted and empty date bounds leave the history unfiltered', () => {
  const db = issueFixture();
  assert.deepEqual(ids(db, { from: '', to: '' }), ids(db));
});

test('Review regression: malformed lower bounds do not broaden the results', () => {
  const db = issueFixture();
  assert.deepEqual(ids(db, { from: 'invalid' }), []);
  assert.deepEqual(ids(db, { from: '2022-02-30', to: '2022-03-31' }), []);
});

test('Review regression: malformed upper bounds return no results', () => {
  const db = issueFixture();
  assert.deepEqual(ids(db, { to: 'invalid' }), []);
  assert.deepEqual(ids(db, { from: '2022-01-01', to: '2022-02-30' }), []);
});

test('Review regression: malformed stored dates stay visible only without date bounds', () => {
  const db = { orders: [
    { id: 1, date: 'unknown' },
    { id: 2, date: '15/01/2022' },
    { id: 3, date: '29/02/2021' },
    { id: 4, date: '29/02/2020' }
  ] };
  assert.deepEqual(new Set(ids(db)), new Set([1, 2, 3, 4]));
  assert.deepEqual(ids(db, { to: '2022-01-31' }), [2, 4]);
  assert.deepEqual(ids(db, { from: '2020-01-01' }), [2, 4]);
});

test('Compatibility: status and search still work independently and together', () => {
  const db = issueFixture();
  assert.deepEqual(ids(db, { status: 'cancelled' }), [1007]);
  assert.deepEqual(ids(db, { search: '  SAVE ' }), [1008]);
  assert.deepEqual(new Set(ids(db, { status: 'completed', search: 'retail' })), new Set([1001, 1004]));
  assert.deepEqual(ids(db, { status: 'completed', search: 'save' }), [1008]);
  assert.deepEqual(ids(db, { status: 'cancelled', search: 'save' }), []);
});

test('Compatibility: date normalization and the April fiscal-year boundary retain their contracts', () => {
  assert.equal(dates.normalizeDateKey(' 2022-01-09 '), '09/01/2022');
  assert.equal(dates.normalizeDateKey(' 09/01/2022 '), '09/01/2022');
  assert.equal(dates.normalizeDateKey(''), '');
  assert.equal(dates.getFiscalYear('31/03/2022'), 'FY21-22');
  assert.equal(dates.getFiscalYear('2022-04-01'), 'FY22-23');
  assert.equal(dates.getFiscalYear(''), 'FY21-22');
});
