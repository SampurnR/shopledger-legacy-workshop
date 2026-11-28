var test = require('node:test');
var assert = require('node:assert/strict');
var dates = require('../lib/dates');
var orders = require('../lib/orders');

function createOrdersDb() {
  return {
    nextOrderId: 1010,
    orders: [
      { id: 1001, date: '28/12/2021', customer: 'Meera Joshi', coupon: '', total: 600, status: 'completed' },
      { id: 1004, date: '30/01/2022', customer: 'Kalyani Foods', coupon: 'SAVE10', total: 4945.5, status: 'completed' },
      { id: 1007, date: '04/03/2022', customer: 'Suresh Deshmukh', coupon: '', total: 1407, status: 'pending' },
      { id: 1008, date: '15/03/2022', customer: 'Walk-in', coupon: 'FEST50', total: 590, status: 'completed' },
      { id: 1009, date: '15/03/2022', customer: 'Anita Rao', coupon: '', total: 800, status: 'cancelled' }
    ]
  };
}

test('Ticket 3 (#3) Dates & Order History', function (t) {
  t.test('normalizeDateKey preserves YYYY-MM-DD contract and getFiscalYear resolves Indian FY', function () {
    assert.equal(dates.normalizeDateKey('30/01/2022'), '2022-01-30');
    assert.equal(dates.normalizeDateKey('2022-01-30'), '2022-01-30');
    assert.equal(dates.normalizeDateKey(' 1 / 2 / 2022 '), '2022-02-01');
    assert.equal(dates.getFiscalYear('31/03/2022'), 'FY21-22');
    assert.equal(dates.getFiscalYear('01/04/2022'), 'FY22-23');
    assert.equal(dates.getFiscalYear('invalid'), 'FY21-22');
  });

  t.test('toComparableDate normalizes valid formats and rejects invalid calendar dates', function () {
    assert.equal(dates.toComparableDate('30/01/2022'), '2022-01-30');
    assert.equal(dates.toComparableDate('1/2/2022'), '2022-02-01');
    assert.equal(dates.toComparableDate(' 1 / 2 / 2022 '), '2022-02-01');
    assert.equal(dates.toComparableDate('15/03/22'), '2022-03-15');
    assert.equal(dates.toComparableDate('2022-01-30'), '2022-01-30');
    assert.equal(dates.toComparableDate('2022-3-4'), '2022-03-04');
    assert.equal(dates.toComparableDate(' 2022 - 3 - 4 '), '2022-03-04');
    assert.equal(dates.toComparableDate('22-03-15'), '2022-03-15');
    assert.equal(dates.toComparableDate('30-01-2022'), '2022-01-30');
    assert.equal(dates.toComparableDate('29/02/2024'), '2024-02-29');

    assert.equal(dates.toComparableDate('29/02/2023'), '');
    assert.equal(dates.toComparableDate('30/02/2022'), '');
    assert.equal(dates.toComparableDate('2022-02-30'), '');
    assert.equal(dates.toComparableDate('99/99/2022'), '');
    assert.equal(dates.toComparableDate('2022-13-01'), '');
    assert.equal(dates.toComparableDate('00/01/2022'), '');
    assert.equal(dates.toComparableDate('invalid'), '');
    assert.equal(dates.toComparableDate(''), '');
    assert.equal(dates.toComparableDate('   '), '');
    assert.equal(dates.toComparableDate(null), '');
    assert.equal(dates.toComparableDate(undefined), '');
  });

  t.test('compareDates compares calendar dates across formats and handles invalid dates', function () {
    assert.equal(dates.compareDates('30/01/2022', '2022-01-30'), 0);
    assert.equal(dates.compareDates('28/12/2021', '02/01/2022'), -1);
    assert.equal(dates.compareDates('15/03/2022', '04/03/2022'), 1);
    assert.equal(dates.compareDates('', '15/03/2022'), -1);
    assert.equal(dates.compareDates('15/03/2022', 'invalid'), 1);
    assert.equal(dates.compareDates('', 'invalid'), 0);
  });

  t.test('orders.list sorts newest-first across months/years with id desc tie-break and no mutation', function () {
    var db = createOrdersDb();
    var beforeOrder = db.orders.map(function (o) { return o.id; });
    var listed = orders.list(db);

    assert.deepEqual(
      listed.map(function (o) { return o.id; }),
      [1009, 1008, 1007, 1004, 1001]
    );
    assert.deepEqual(
      db.orders.map(function (o) { return o.id; }),
      beforeOrder
    );

    assert.deepEqual(orders.list(null), []);
    assert.deepEqual(orders.list({}), []);
  });

  t.test('orders.list filters inclusively by from/to, status, and search', function () {
    var db = createOrdersDb();
    var jan = orders.list(db, { from: '2022-01-01', to: '2022-01-31' });
    assert.deepEqual(jan.map(function (o) { return o.id; }), [1004]);

    var exactDay = orders.list(db, { from: '30/01/2022', to: '2022-01-30' });
    assert.deepEqual(exactDay.map(function (o) { return o.id; }), [1004]);

    var mar = orders.list(db, { from: '04/03/2022', to: '15/03/2022', status: 'completed', search: '  walk  ' });
    assert.deepEqual(mar.map(function (o) { return o.id; }), [1008]);

    var byCoupon = orders.list(db, { search: '  SAVE10 ' });
    assert.deepEqual(byCoupon.map(function (o) { return o.id; }), [1004]);
  });

  t.test('orders.list excludes empty/invalid order dates on active range filters and ignores blank filters', function () {
    var edgeDb = {
      orders: [
        { id: 1, date: '', customer: 'Empty Date', status: 'completed' },
        { id: 2, date: '30/02/2022', customer: 'Invalid Date', status: 'completed' },
        { id: 3, date: '15/01/2022', customer: 'Valid Jan', status: 'completed' }
      ]
    };

    var toFiltered = orders.list(edgeDb, { to: '2022-01-31' });
    assert.deepEqual(toFiltered.map(function (o) { return o.id; }), [3]);

    var fromFiltered = orders.list(edgeDb, { from: '2022-01-01' });
    assert.deepEqual(fromFiltered.map(function (o) { return o.id; }), [3]);

    var blankFilters = orders.list(edgeDb, { from: '   ', to: '   ', search: '   ', status: 'all' });
    assert.deepEqual(blankFilters.map(function (o) { return o.id; }), [3, 2, 1]);
  });
});
