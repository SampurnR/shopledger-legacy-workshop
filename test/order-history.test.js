var test = require('node:test');
var assert = require('node:assert/strict');
var orders = require('../lib/orders');
var dates = require('../lib/dates');

function fixture() {
  return { orders: [
    { id: 1001, date: '28/12/2021', customer: 'Test retail', status: 'completed' },
    { id: 1004, date: '30/01/2022', customer: 'Test wholesale', status: 'completed' },
    { id: 1007, date: '04/03/2022', customer: 'Test wholesale', status: 'pending' },
    { id: 1008, date: '15/03/2022', customer: 'Walk-in', status: 'completed' }
  ] };
}

function ids(list) {
  return list.map(function (order) { return order.id; });
}

test('REGRESSION: history sorts newest first across months and years', function () {
  assert.deepEqual(ids(orders.list(fixture())), [1008, 1007, 1004, 1001]);
});

test('REGRESSION: January range excludes December and March orders', function () {
  assert.deepEqual(ids(orders.list(fixture(), { from: '2022-01-01', to: '2022-01-31' })),
    [1004]);
});

test('REGRESSION: date keys normalize either format to padded year-first order', function () {
  assert.equal(dates.normalizeDateKey('2022-03-04'), '2022-03-04');
  assert.equal(dates.normalizeDateKey('04/03/2022'), '2022-03-04');
  assert.equal(dates.normalizeDateKey(' 4/3/2022 '), '2022-03-04');
  assert.equal(dates.normalizeDateKey('2022-3-4'), '2022-03-04');
  assert.equal(dates.normalizeDateKey(''), '');
});

test('listing preserves stored order and date values', function () {
  var db = fixture();
  var before = JSON.stringify(db);
  orders.list(db, { search: 'wholesale' });
  assert.equal(JSON.stringify(db), before);
});

test('search and status filters compose', function () {
  assert.deepEqual(ids(orders.list(fixture(), { search: 'WHOLESALE', status: 'pending' })), [1007]);
  assert.deepEqual(ids(orders.list(fixture(), { search: '1004', status: 'all' })), [1004]);
});

test('fiscal years retain April boundaries with either date format', function () {
  assert.equal(dates.getFiscalYear('31/03/2022'), 'FY21-22');
  assert.equal(dates.getFiscalYear('2022-03-31'), 'FY21-22');
  assert.equal(dates.getFiscalYear('01/04/2022'), 'FY22-23');
  assert.equal(dates.getFiscalYear('2022-04-01'), 'FY22-23');
  assert.equal(dates.getFiscalYear(''), 'FY21-22');
});

test('REGRESSION: inclusive boundaries and one-sided ranges work in either format', function () {
  assert.deepEqual(ids(orders.list(fixture(), { from: '30/01/2022', to: '2022-03-04' })), [1007, 1004]);
  assert.deepEqual(ids(orders.list(fixture(), { from: '2022-03-04' })), [1008, 1007]);
  assert.deepEqual(ids(orders.list(fixture(), { to: '2022-01-30' })), [1004, 1001]);
  assert.deepEqual(ids(orders.list(fixture(), { from: '2022-03-04', to: '04/03/2022' })), [1007]);
  assert.deepEqual(orders.list(fixture(), { from: '2022-03-15', to: '2022-01-30' }), []);
});

test('REGRESSION: mixed stored formats sort chronologically with stable equal-date ordering', function () {
  var db = { orders: [
    { id: 1, date: '31/12/2021' }, { id: 2, date: '2022-01-01' },
    { id: 3, date: '01/01/2022' }, { id: 4, date: '2022-01-02' }
  ] };
  assert.deepEqual(ids(orders.list(db)), [4, 2, 3, 1]);
});

test('REGRESSION: date ranges compose with status and search filters', function () {
  assert.deepEqual(ids(orders.list(fixture(), {
    from: '2022-03-01', to: '2022-03-31', search: 'wholesale', status: 'completed'
  })), []);
});
