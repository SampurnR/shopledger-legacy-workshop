var test = require('node:test');
var assert = require('node:assert/strict');
var orders = require('../lib/orders');
var dates = require('../lib/dates');

// Pure module calls only: no server, store, or persistent data access.
function fixture() {
  return { orders: [
    { id: 1, date: '31/12/2025' },
    { id: 2, date: '01/01/2026' },
    { id: 3, date: '15/01/2026' },
    { id: 4, date: '02/02/2026' }
  ] };
}

function ids(db, filters) {
  return orders.list(db, filters).map(function (order) { return order.id; });
}

test('CURRENT BEHAVIOUR: date keys convert ISO dates to day-first strings', function () {
  assert.equal(dates.normalizeDateKey('2026-02-02'), '02/02/2026');
  assert.equal(dates.normalizeDateKey(' 02/02/2026 '), '02/02/2026');
  assert.equal(dates.normalizeDateKey(''), '');
  assert.equal(dates.normalizeDateKey('not-a-date'), 'date/a/not');
});

test('REGRESSION: history sorts chronologically without mutating the source', function () {
  var db = fixture();
  var before = JSON.parse(JSON.stringify(db));
  assert.deepEqual(ids(db), [4, 3, 2, 1]);
  assert.deepEqual(db, before);
  assert.notStrictEqual(orders.list(db), db.orders);
});

test('REGRESSION: lower date bound excludes older dates and includes later months', function () {
  assert.deepEqual(ids(fixture(), { from: '2026-01-15' }), [4, 3]);
});

test('REGRESSION: upper date bound includes older years and excludes later months', function () {
  assert.deepEqual(ids(fixture(), { to: '2026-01-15' }), [3, 2, 1]);
});

test('REGRESSION: chronological range across a month boundary includes matching orders', function () {
  assert.deepEqual(ids(fixture(), { from: '2026-01-15', to: '2026-02-02' }), [4, 3]);
});

test('CURRENT BEHAVIOUR: same-month bounds are inclusive for ISO and day-first inputs', function () {
  var db = { orders: [
    { id: 1, date: '09/01/2026' },
    { id: 2, date: '10/01/2026' },
    { id: 3, date: '15/01/2026' },
    { id: 4, date: '20/01/2026' },
    { id: 5, date: '21/01/2026' }
  ] };
  assert.deepEqual(ids(db, { from: '2026-01-10', to: '2026-01-20' }), [4, 3, 2]);
  assert.deepEqual(ids(db, { from: '10/01/2026', to: '20/01/2026' }), [4, 3, 2]);
});
